---
title: "NestJS Deep Dive: 실전 커스텀 데코레이터 설계 가이드"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "decorators", "metadata", "design-patterns"]
---

## 데코레이터: 코드 위의 추상화와 선언

NestJS 개발의 정수는 **데코레이터(`Decorator`)**다. 우리는 `@Get()`, `@Post()`, `@Inject()` 등을 통해 코드가 무엇을 하는지 '선언'한다. 하지만 이미 제공되는 것 이상의 복잡한 비즈니스 로직(예: 권한, 로깅, 캐시, 메트릭 수집)을 한 줄의 데코레이터로 압축하고 싶다면 어떻게 설계해야 할까?

이번 아티클에서는 `Reflect-metadata`, `Reflector`, `DiscoveryService` 등 그동안 우리가 딥다이브한 내용을 총동원하여, 실전에서 성능과 유지보성 두 마리 토끼를 잡는 **강력한 커스텀 데코레이터 설계 전략**을 제시한다.

---

## 1. 데코레이터의 세 가지 계층 구조

데코레이터를 설계할 때, 해당 데이터가 어디에 저장되고 어떻게 사용되는지 명확히 구분해야 한다.

1. **Class Decorator**: 클래스 전체의 정체성을 규정. (예: `@MyPlugin()`)
2. **Method Decorator**: 특정 메서드의 기능을 확장. (예: `@OnEvent('user.created')`)
3. **Param Decorator**: 메서드에 전달되는 인자를 가공. (예: `@CurrentUser()`)

### 실전 예시: @ApiAccess(key: string)

특정 API에 대한 접근 권한을 관리하는 커스텀 데코레이터를 제작해 보자.

---

## 2. 메타데이터 설계 전략: Key의 유니크함

메타데이터는 전역 레지스트리에 저장되므로, 다른 모듈과 충돌하지 않는 **유니크한 키**를 사용하는 것이 가장 중요하다.

```typescript
// 유니크한 Symbol 또는 문자열 키 정의
export const API_ACCESS_METADATA_KEY = 'custom:api_access_metadata';

// 데코레이터 팩토리 함수
export const ApiAccess = (key: string) => 
  SetMetadata(API_ACCESS_METADATA_KEY, key);
```

NestJS가 제공하는 `SetMetadata`는 내부적으로 `Reflect.defineMetadata`를 감싼 유틸리티 함수다. 이를 사용하는 것이 관례다.

---

## 3. 런타임 추출과 가로채기 (Interception)

데코레이터는 데이터를 '저장'할 뿐, 실제로 '실행'하지는 않는다. 실행을 위한 엔진은 별도로 필요하다.

### 가드(Guard)를 통한 가량 횡단 관심사 처리

보안이나 권한 같은 로직은 가드(`Guard`)가 최적이다.

```typescript
@Injectable()
export class ApiAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Reflector를 통해 우선순위(Handler > Class)를 고려하여 읽어온다.
    const accessKey = this.reflector.getAllAndOverride<string>(
      API_ACCESS_METADATA_KEY,
      [context.getHandler(), context.getClass()]
    );
    
    // 2. 비즈니스 로직 실행
    if (!accessKey) return true; // 설정 안 됐으면 통과
    
    const request = context.switchToHttp().getRequest();
    return request.headers['x-api-key'] === accessKey;
  }
}
```

---

## 4. 고급 설계: 파라미터 데코레이터와 @createParamDecorator

가드가 외부 보안을 담당한다면, 파라미터 데코레이터는 내부 데이터 가공을 담당한다.

```typescript
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

이 데코레이터는 NestJS의 `ExecutionContext`를 자유자재로 사용하여, 컨트롤러 핸들러 내부에서 필요한 데이터만 쏙 뽑아 쓸 수 있게 해준다.

---

## 요약: 좋은 데코레이터 설계를 위한 체크리스트

1. **명확한 책임**: 저장(Decorator)과 실행(Guard/Interceptor)을 명확히 분리했는가?
2. **유니크한 키**: 메타데이터 키가 충돌할 가능성은 없는가?
3. **오버라이딩 정책**: 클래스 레벨과 메서드 레벨의 충돌 시 `getAllAndOverride`를 사용할 것인가?
4. **타입 안전성**: 데코레이터에 전달되는 인자의 타입을 명확히 정의했는가?

커스텀 데코레이터를 잘 설계한다는 것은, 복잡한 비즈니스 코드를 뒤로 숨기고 **의도가 명확한 DSL(Domain Specific Language)**을 구축하는 것과 같다. 이것이 진정한 NestJS 마스터의 코드다.

지금까지 메타데이터와 리플렉션 테마를 성공적으로 정복했다. 다음 테마는 요청이 들어오는 그 순간부터의 여정인 **요청 생명주기(Request Lifecycle) 정밀 분석**이다.
