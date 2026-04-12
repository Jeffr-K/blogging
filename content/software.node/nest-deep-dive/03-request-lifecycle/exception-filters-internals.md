---
title: "NestJS Deep Dive: Exception Filter 내부 메커니즘과 일관성 유지 전략"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "exception-filter", "error-handling", "internals"]
---

## 에러의 수문장: Exception Filters

NestJS 애플리케이션에서 발생하는 모든 예외(Exception)는 마지막에 **`Exception Filter`**에 도착한다. 프레임워크가 기본적으로 제공하는 `BaseExceptionFilter`가 내장되어 있어, 우리가 아무 처리를 하지 않아도 깔끔한 JSON 응답을 볼 수 있는 비결이 여기에 있다.

하지만 실제 서비스에서는 에러 응답을 우리 팀만의 공통 포맷으로 정의하거나, 특정 에러에 대한 로깅 체계를 구축해야 한다. 이번 아티클에서는 `Exception Filter`가 어떻게 모든 에러를 포착하고 런타임 콜백을 수행하는지 딥다이브해 본다.

---

## 1. Exception Zone: 모든 에러의 시작점

NestJS 내부 소스 코드에는 **`ExceptionZone`**이라는 개념이 있다. 파이프라인의 거의 모든 단계를 `try-catch`로 감싸고 있으며, 에러가 발생하면 이를 `ExceptionsHandler`로 던진다.

- **ExceptionsHandler**: 현재 컨텍스트에 등록된 필터들을 찾고, 가장 적절한 필터의 `catch()` 메서드를 실행한다.

---

## 2. 딥다이브: Filter의 우선순위와 적용 범위

에외 필터도 가드나 인터셉터처럼 전역(Global), 컨트롤러(Controller), 메서드(Method) 레벨로 적용할 수 있다.

- **실행 순서**: 메서드필터 -> 컨트롤러필터 -> 전역필터 (**가장 구체적인 것부터!**)
- **중요**: 만약 더 구체적인 필터(메서드 필터)에서 에러를 포착하여 응답을 보내면, 상위 레벨(전역 필터)은 실행되지 않는다.

---

## 3. 커스텀 필터 설계: HttpArgumentsHost 활용

커스텀 필터를 만들 때 우리는 `ArgumentsHost`를 통해 원시 응답 객체에 접근한다.

```typescript
@Catch(HttpException)
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // 우리 팀만의 고정된 응답 포맷 정의
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message,
    });
  }
}
```

---

## 4. 실전: 외부 에러 필터링 (External Libraries)

TypeORM이나 MikroORM, 또는 서드파티 라이브러리에서 발생하는 에러는 `HttpException`이 아닌 일반 `Error` 객체일 수 있다.

- **@Catch(Error)**: 모든 예외를 잡는 최후의 수단.
- **팁**: 특정 데이터베이스 에러 코드를 분석하여, 이를 사용자에게 친절한 `HttpException`으로 변환해 주는 공통 필터를 구축하면 프로젝트 전반의 에러 대응력이 극적으로 높아진다.

---

## 요약

`Exception Filter`는 NestJS 요청 파이프라인의 **'최후의 방어선'**이다.

- 기본 필터(`BaseExceptionFilter`)의 동작 원리를 이해하자.
- 계층별 우선순위를 고려하여 필터를 배치하자.
- `ArgumentsHost`를 통해 요청 데이터를 확보하고, 표준화된 에러 응답을 설계하자.

이 방어선을 견고하게 구축하면, 애플리케이션의 어떤 지점에서 에러가 발생하더라도 사용자에게는 일관되고 정제된 경험을 줄 수 있다.

지금까지 요청 생명주기 테마를 성공적으로 정복했다. 다음 테마는 분산 시스템의 핵심인 **커스텀 트랜스포터와 마이크로서비스 내부**다.
