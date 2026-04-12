---
title: "NestJS Deep Dive: forwardRef와 순환 의존성(Circular Dependency)의 비밀"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "forward-ref", "circular-dependency", "internals"]
---

## 순환 참조의 고통과 해결사 forwardRef

백엔드 개발을 하다 보면 피해 가기 어려운 상황 중 하나가 **순환 의존성(Circular Dependency)**이다.

A 서비스는 B 서비스를 주입받아야 하고, B 서비스는 다시 A 서비스를 주입받아야 하는 상황. NestJS에서는 기본적으로 이러한 구조를 금지한다. 왜냐하면 애플리케이션 시작 시점에 `InstanceLoader`가 인스턴스를 하나하나 만들다가 이 무한 루프에 빠지기 때문이다.

하지만 실무에서는 불가피한 비즈니스 로직 얽힘이 발생할 수 있다. 이때 우리를 구원해 주는 도구가 바로 **`forwardRef`**다. 이번 아티클에서는 `forwardRef`가 어떻게 실제 클래스 정의가 준비되지 않은 시점에 주입을 가능하게 하는지, 그 내부 원리를 파헤쳐 본다.

---

## 1. 왜 순환 의존성이 문제가 되는가?

NestJS의 `InstanceLoader`는 인스턴스를 만들 때 **대상의 생성자(Constructor)**를 호출한다.

1. `UsersService`를 만들려고 보니 `AuthService`가 생성자 인자로 필요하다.
2. 그럼 `AuthService`를 먼저 만든다.
3. 그런데 `AuthService`를 만들려고 보니 다시 생성자 인자로 `UsersService`가 필요하다.
4. **폭발!** (컴파일 시점에 에러 또는 런타임에 인스턴스 생성 실패)

이 시점에서 `UsersService`는 아직 태어나지도 않았는데 `AuthService`가 이를 필요로 하니, JavaScript의 변수 호이스팅(Hoisting)으로도 해결할 수 없는 **정체성 상실(Identity Crisis)**이 발생하는 것이다.

---

## 2. forwardRef의 마법: 지연 평가 (Lazy Evaluation)

`forwardRef`는 NestJS가 제공하는 고차 함수(Higher-order Function)로, 그 정의는 의외로 매우 단순하다.

```typescript
export const forwardRef = (fn: () => any) => ({
  forwardRef: fn,
});
```

핵심은 **'함수(`fn`)로 감싸는 것'**이다. 클래스 그 자체(`UsersService`)를 주입하는 대신, 그 클래스를 **반환하는 함수**를 전달하는 것이다.

---

## 3. 내부 동작 원리의 딥다이브

`DependenciesScanner`와 `InstanceLoader`가 `forwardRef`를 만나면 어떤 일이 벌어질까?

1. **Scanner**: 의존성 정보를 스캔할 때, `forwardRef`로 감싸진 항목을 발견하면 이를 즉시 처리하지 않고 **'나중에 호출될 콜백'**으로 저장해 둔다.
2. **InstanceLoader**: 실제 인스턴스를 주입할 시점에 `forwardRef`에 담긴 함수를 실행한다.
3. **지연 실행**: 이때는 이미 모든 모듈 스캔이 끝난 시점(런타임 초기화 중반부)이므로, `UsersService` 클래스 정의(Metatype)를 안전하게 읽어올 수 있게 된다.

즉, **"지금 당장 이 클래스가 뭔지 몰라도 돼. 나중에 내가 이 함수를 부를 테니 그때 알려줘"**라고 프레임워크에게 약속하는 셈이다.

---

## 4. 실전 활용과 주의사항

### 모듈 간 순환 참조

모듈끼리 서로 `imports` 할 때도 `forwardRef`가 필요하다.

```typescript
@Module({
  imports: [forwardRef(() => AuthModule)],
})
export class UsersModule {}
```

### 프로바이더 간 순환 참조

`@Inject()` 데코레이터와 함께 사용한다.

```typescript
constructor(
  @Inject(forwardRef(() => AuthService))
  private readonly authService: AuthService,
) {}
```

### 아키텍처적 관찰

`forwardRef`는 강력한 도구이지만, 남용해서는 안 된다.

- 과도한 `forwardRef` 사용은 모듈 간의 결합도가 너무 높다는 신호다.
- 가능하다면 공통된 로직을 제3의 모듈(예: `SharedModule`)로 분리하여 **단방향 의존성**을 유지하는 것이 가장 우아한 설계다.

---

## 요약

`forwardRef`는 **함수 기반의 지연 평가** 메커니즘을 통해 NestJS의 정적 분석과 동적 주입 사이의 모순을 해결한다.

프레임워크의 부트스트래핑 과정에서 "모든 클래스가 로드된 뒤에야 실제 의존성을 결정한다"는 유연성을 제공함으로써, 복잡한 비즈니스 요건을 아키텍처적으로 수용할 수 있게 해준다.

다음 아티클에서는 이러한 주입 방식의 끝판왕인 **Custom Provider**의 내부 구조와, 정적 주입과 동적 주입이 실제 메모리 상에서 어떻게 다르게 관리되는지 살펴본다.
