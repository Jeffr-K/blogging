---
title: "NestJS Deep Dive: Guard와 Interceptor의 실행 순서 및 우선순위"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "request-lifecycle", "guards", "interceptors", "priority"]
---

## 흐름의 지배자: 실행 순서의 중요성

NestJS의 요청 처리 과정(Request Pipeline)은 매우 정교하다. 하지만 많은 개발자들이 가드(Guard), 인터셉터(Interceptor), 미들웨어(Middleware)가 정확히 **어떤 순서**로 실행되는지 헷갈려하곤 한다.

"내 인터셉터에서 가드의 결과물을 쓸 수 있을까?", "전역 가드와 메서드 가드 중 누가 먼저일까?" 이 질문들에 대한 명확한 기술적 근거를 이번 아티클에서 딥다이브해 본다.

---

## 1. NestJS 요청 파이프라인의 핵심 여정

전체적인 실행 순서는 다음과 같다. **반드시 외워야 할 정석이다.**

1. **Middleware** (Global → Module)
2. **Guards** (Global → Controller → Route)
3. **Interceptors (Pre-handler)** (Global → Controller → Route)
4. **Pipes** (Global → Controller → Route → Param)
5. **Handler** (실제 비즈니스 로직 실행)
6. **Interceptors (Post-handler)** (Route → Controller → Global - **역순!**)
7. **Exception Filters** (Route → Controller → Global - **역순!**)

---

## 2. 딥다이브: 왜 가드가 인터셉터보다 먼저 실행될까?

- **설계 의도**: 가드는 **접근 권한(Authorization)**을 담당한다. 권한이 없는 요청은 아예 인터셉터나 파이프가 돌아가기도 전에(리소스 낭비 전) 차단해야 하기 때문다.
- **내부 동작**: `GuardsConsumer`는 핸들러가 호출되기 훨씬 전 단계에서 실행되지만, `InterceptorsConsumer`는 실제 핸들러 호출을 **래핑(Wrapping)**하고 있다.

---

## 3. 계층별 우선순위 (Global vs Controller vs Route)

모든 요청 구성 요소(Guard, Interceptor, Pipe)는 다음과 같은 계층 순서로 실행된다.

- **들어올 때(Entering)**: 전역(Global) -> 컨트롤러(Controller) -> 라우터/메서드(Route)
- **나갈 때(Exiting - Interceptor/Filter)**: 라우터/메서드 -> 컨트롤러 -> 전역

**유의사항**: 전역 가드는 가장 먼저 실행되어 대문을 지키고, 상세한 라우터 가드는 마지막에 실행되어 세부 권한을 체크한다.

---

## 4. 커스텀 인터셉터에서 가드 데이터 참조하기

인터셉터는 가드가 성공한 뒤에 실행되므로, 가드에서 `request` 객체에 담아둔 데이터(예: `request.user`)를 인터셉터에서 안전하게 사용할 수 있다.

하지만 반대로 가드에서 인터셉터가 처리할 데이터를 미리 아는 것은 구조적으로 불가능하다. (파이프라인 순서상 가드가 앞서기 때문)

---

## 요약: 흐름을 알아야 설계가 보인다

NestJS의 실행 순서는 **리소스를 최소한으로 쓰고 보안을 최대한으로 보장**하기 위한 철저한 설계 결과다.

- 무거운 로직은 가급적 뒤쪽(Interceptor)에 두자.
- 권한 체크는 가급적 앞쪽(Guard)에서 끝내자.
- 공통 포맷 변환은 나갈 때의 인터셉터 파이프라인을 활용하자.

이 순서를 명확히 이해하면, 복잡한 요청 처리 로직을 어느 단계에 배치해야 할지 더 이상 고민하지 않게 된다.

다음 아티클에서는 이 모든 과정에서 에러가 발생했을 때 등장하는 **Exception Filter의 전역 및 커스텀 핸들링 메커니즘**을 딥다이브해 본다.
