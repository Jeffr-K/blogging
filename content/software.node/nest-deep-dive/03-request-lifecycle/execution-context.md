---
title: "NestJS Deep Dive: ExecutionContext와 ArgumentsHost 추상화 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "execution-context", "arguments-host", "internals"]
---

## 데이터의 그릇: ArgumentsHost와 ExecutionContext

NestJS는 HTTP(Express/Fastify)뿐만 아니라 마이크로서비스(TCP, Redis, Kafka), 웹소켓(Socket.io, Ws) 등 다양한 프로토콜을 지원한다. 하지만 가드(Guard)나 인터셉터(Interceptor)는 어떤 프로토콜이든 상관없이 동작해야 한다.

이 불가능해 보이는 요청 데이터의 **추상화(Abstraction)**를 가능하게 하는 정교한 그릇이 바로 **`ArgumentsHost`**와 **`ExecutionContext`**다. 이번 아티클에서는 이 객체들이 어떻게 다양한 환경의 데이터를 안전하게 래핑(Wrapping)하는지 딥다이브해 본다.

---

## 1. ArgumentsHost: 데이터의 추상적 접근

`ArgumentsHost`는 핸들러로 전달되는 인자(Arguments)들의 배열을 관리한다.

```typescript
// HTTP 요청일 경우
const [request, response, next] = host.getArgs();

// RPC(마이크로서비스) 요청일 경우
const [data, context] = host.getArgs();
```

가장 중요한 기능은 **`switchToHttp()`, `switchToRpc()`, `switchToWs()`**와 같은 스위칭 메서드다.

- **switchToHttp()**: 내부적으로 `HttpArgumentsHost` 객체를 반환한다. 이를 통해 `getRequest()`, `getResponse()`를 호출할 수 있다.
- **추상화 원리**: NestJS는 각 플랫폼의 어댑터를 통해 원시 응답과 요청 객체를 이 호스트 객체에 배열 형태로 담아둔다. 그리고 우리가 `switchToHttp()`를 부르면 그 배열 내의 특정 인덱스 요소를 정해진 이름으로 반환해 줄 뿐이다.

---

## 2. ExecutionContext: 실행 환경의 메타데이터

`ExecutionContext`는 `ArgumentsHost`를 상속(Inheritance)받은 더 강력한 클래스다. 요청 데이터뿐만 아니라, 현재 실행 중인 **클래스(Class)**와 **핸들러(Method)**에 대한 정보까지 포함한다.

1. **getClass()**: 현재 요청을 처리하고 있는 컨트롤러 클래스 정의.
2. **getHandler()**: 현재 실행될 예정인 라우터 핸들러 함수 정의.

이 두 정보는 가드나 인터셉터에서 **`Reflector`**와 결합될 때 폭발적인 시너지를 낸다. 클래스나 메서드에 붙은 커스텀 데코레이터 메타데이터를 이 시점에 읽을 수 있기 때문이다.

---

## 3. 딥다이브: 컨텍스트의 재사용과 성능

가드와 인터셉터는 매 요청마다 실행된다. 그렇다면 이 `ExecutionContext` 객체도 매번 새로 만들어질까?

- **내부 동작**: NestJS는 요청이 들어오면 `ExecutionContextFactory`를 사용하여 새 객체를 생성한다.
- **최적화**: 하지만 객체 생성 비용을 줄이기 위해 내부적으로 플랫폼별 어댑터의 데이터를 캐싱하거나 정적인 메타데이터(`class`, `handler`)는 미리 인덱싱해 둔다.

---

## 4. 실전 활용: 범용 인터셉터 제작 전략

다양한 프로토콜을 동시에 지원하는 하이브리드 앱(HTTP + Microservice)이라면, `switchTo*` 메서드를 사용하여 다음과 같은 견고한 로직을 짤 수 있다.

```typescript
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const type = context.getType(); // 'http' | 'rpc' | 'ws'
  
  if (type === 'http') {
    // HTTP 전용 로깅
    const request = context.switchToHttp().getRequest();
    console.log(`URL: ${request.url}`);
  } else if (type === 'rpc') {
    // RPC 전용 로깅
    const data = context.switchToRpc().getData();
    console.log(`Payload: ${JSON.stringify(data)}`);
  }
  
  return next.handle();
}
```

---

## 요약

`ArgumentsHost`는 **요청 데이터(Payload)**에 집중하고, `ExecutionContext`는 **실행 문맥(Metadata)**에 집중한다. 이 두 객체는 NestJS가 지향하는 **"다양한 프로콜 간의 소스 코드 일관성"**을 유지하는 핵심 추상화 계층이다.

이 구조를 완벽하게 이해하고 다룬다면, 어떤 환경에서도 동작하는 범용적인 유틸리티와 라이브러리를 직접 구축할 수 있게 된다.

다음 아티클에서는 이 길 위에서 만나는 데이터 가공의 핵심, **Pipe 시스템의 내부 구조와 동작 원리**를 살펴본다. (이미 이전 테마에서 다룬 바 있으므로, 복습 후 가드와 인터셉터의 우선순위로 넘어간다.)
