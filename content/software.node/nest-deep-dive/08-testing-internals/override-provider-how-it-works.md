---
title: "NestJS Deep Dive: overrideProvider와 의존성 주입 가로채기"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "override-provider", "mocking", "di", "internals"]
---

## 가로채기 전략: overrideProvider

테스트 중에 실제 데이터베이스나 외부 API 전송 서비스를 주입받고 싶지 않을 때, 우리는 `overrideProvider('SERVICE_KEY')`를 사용한다. 이 심플한 문장은 내부적으로 `NestContainer`가 가진 **의존성 맵(Dependency Map)**을 강제로 덮어씌우는 고도의 코드 조작 행위다.

이번 아티클에서는 `overrideProvider`가 어떻게 동작하며, `useValue`, `useFactory`, `useClass`를 통해 가짜 구현체를 정교하게 주입하는지 그 내부를 딥다이브해 본다.

---

## 1. overrideProvider의 부드러운 개입

`Test.createTestingModule()`을 부르면 `TestingModuleBuilder`가 반환된다.

- **override**: 이 도구는 `NestContainer`가 가진 `providers` 배열을 훑으며, 사용자가 넘겨준 **토큰(Token)**과 일치하는 항목을 찾아낸다.
- **덮어쓰기(Substitution)**: 찾았다면, 기존의 클래스나 팩토리 정보를 버리고 사용자가 새로 정의한 `useValue`나 `useFactory`로 **치환**한다.

---

## 2. 딥다이브: 컴파일 전(Pre-compile) 오버라이딩

중요한 점은 오버라이딩이 반드시 **`compile()` 호출 전**에 완료되어야 한다는 것이다.

1. **Scanner**: 우리가 넘겨준 원본 모듈들을 스캔한다.
2. **Overrides Mapping**: 사용자가 `overrideProvider`로 가로채겠다고 선언한 맵을 한 번 더 훑는다.
3. **Replacement**: 원본 프로바이더 대신 오버라이드된 가로채기 프로바이더를 컨테이너에 최종 결정(Finalize)한다.

---

## 3. 실전: 다양한 오버라이드 패턴

- **useValue**: 미리 준비된 가짜 데이터(객체)를 주입.
- **useFactory**: 동적인 목(Mock) 객체나, `jest.fn()`이 포함된 팩토리를 주입.
- **useClass**: 테스트용으로 따로 만든 클래스 구현체(`MockUsersService`)를 주입.

```typescript
// 실전 예시: 실제 Redis 서비스를 Mock 서비스로 교체
const module = await Test.createTestingModule({
  imports: [AppModule],
})
.overrideProvider(RedisService)
.useValue({ get: jest.fn(), set: jest.fn() })
.compile();
```

---

## 4. 가드와 인터셉터도 가로챌 수 있다 (overrideGuard)

서비스뿐만 아니라 복잡한 가드(`AuthGuard`)나 인터셉터도 통째로 모킹할 수 있다.

- **`overrideGuard(AuthGuard).useValue({ canActivate: () => true })`**: 이렇게 한 줄만 쓰면, 실제 인증 로직이 어떻게 되어 있든 테스트 환경에서는 무조건 통과하도록 조작할 수 있다.

### 내부 원리

NestJS는 가드 또한 하나의 프로바이더(`APP_GUARD` 토큰으로 등록된)로 취급한다. 따라서 `overrideGuard`는 내부적으로는 해당 가드 클래스의 메타데이터 레벨에서 동작을 덮어씌우는 방식을 사용한다.

---

## 요약

`override` 계열 메서드는 **"DI 컨테이너의 권력을 가로채는 도구"**다.

- 실체와 허상의 경계를 자유롭게 오가며 테스트 환경을 조작하자.
- `compile()` 이전에 모든 가로채기 설정을 끝내야 함을 명심하자.
- 서비스뿐만 아니라 가드, 필터, 인터셉터까지 넘나들며 완벽한 격리 테스트를 구축하자.

이 지식을 마스터하면, 아무리 복잡하게 얽힌 모듈 구조에서도 내가 원하는 부분만 떼어내어 정밀한 수술(Test)을 집도할 수 있는 능력이 생기게 된다.

다음 아티클에서는 이러한 단위 기술들을 결합하여, 실전에서 바로 쓸 수 있는 **통합 테스트와 E2E 테스트 환경 구축 전략**을 딥다이브해 본다.
