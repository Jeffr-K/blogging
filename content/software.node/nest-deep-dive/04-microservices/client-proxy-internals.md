---
title: "NestJS Deep Dive: ClientProxy 내부 메커니즘 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "client-proxy", "microservices", "internals"]
---

## 메시지의 발신기: ClientProxy

NestJS 마이크로서비스 생태계에서 다른 서비스로 메시지를 보내기 위해 우리는 늘 **`ClientProxy`**를 사용한다. `client.send('pattern', data)`를 부르기만 하면, 우리는 마치 로컬 함수를 쓰는 것처럼 응답을 받아올 수 있다.

하지만 실제 네트워크 통신은 비동기적으로 일어난다. 도대체 `ClientProxy`는 어떻게 메시지를 보내고, 그 수많은 응답 중에서 **우리가 보낸 요청에 대한 응답**을 정확히 찾아 리턴해 주는 것일까? 이번 아티클에서는 `ClientProxy`의 내부 메커니즘을 딥다이브해 본다.

---

## 1. ClientProxy의 핵심 메서드: send()와 emit()

- **send(pattern, data)**: 요청-응답(Request-Response) 방식. 통신의 끝까지 결과를 기다리며, `Observable`을 반환한다.
- **emit(pattern, data)**: 이벤트 기반(Event-based). 메시지를 던지고 끝난다(Fire and Forget). 응답을 기다리지 않는다.

---

## 2. 딥다이브: 상관관계 ID (Correlation ID)

`ClientProxy.send()`가 호출되면, 내부적으로 다음과 같은 일이 순차적으로 일어난다.

1. **패킷 생성**: 보낼 데이터와 함께 유니크한 `id` 필드(**Correlation ID**)를 생성하여 패킷에 담는다.
2. **응답 대기 등록(Routing)**: 이 `id`를 키로 하고, 해당 응답을 처리할 `Subject`(RxJS)를 값으로 하는 내부 **맵(`routingMap`)**에 등록한다.
3. **메시지 전송**: 실제 트랜스포터(TCP, Redis 등)를 통해 패킷을 전송한다.

### 응답이 돌아올 때

네트워크를 통해 서버로부터 응답이 오면, `ClientProxy`는 패킷을 열어 `id`를 확인한다.

- `routingMap`에서 해당 `id`를 가진 `Subject`를 찾는다.
- 찾은 `Subject`에 응답 데이터를 실어 `next()`를 호출한다.
- 이제 우리 코드의 `Observable`이 구독자에게 데이터를 전달하게 된다.

이것이 비동기 환경에서도 특정 요청과 응답을 1:1로 매칭시키는 비결이다.

---

## 3. RxJS 기반의 흐름 제어

`ClientProxy`가 `Observable`을 반환한다는 점은 매우 강력하다.

- **타임아웃(Timeout)**: `timeout()` 오퍼레이터를 붙여 응답이 늦으면 에러를 낼 수 있다.
- **재시도(Retry)**: `retry()`를 통해 네트워크 일시 오류 시 다시 호출하게 할 수 있다.

내부적으로 `ClientProxy`는 `publish()`, `connect()` 등의 RxJS 연산자를 사용하여, 응답이 올 때까지 스트림을 열어두고 응답이 오면 즉시 닫는(Complete) 지능형 수명주기를 관리한다.

---

## 4. 직렬화와 역직렬화 (Serialization)

메시지가 네트워크를 타기 전, `ClientProxy`는 **`Serializer`**를 호출한다.

- **JSON Serializer**: 기본값이다. 데이터를 JSON 문자열로 바꾼다.
- **커스텀 Serializer**: 필요하다면 바이너리 포맷(Protocol Buffers) 등으로 압축하여 전송량을 줄일 수 있다.

---

## 요약

`ClientProxy`는 단순한 클라이언트가 아니라, **비동기 통신의 상관관계를 관리하는 지능형 대리자(Proxy)**다.

- `Correlation ID`를 통한 요청-응답 매칭 원리를 이해하자.
- RxJS의 힘을 빌려 선언적으로 통신 흐름을 제어하자.
- 트랜스포터에 최적화된 직렬화 전략을 선택하자.

이 내부 구조를 명확히 알면, 분산 환경에서 발생하는 타임아웃, 메시지 소실, 성능 저하 문제에 대해 정확한 진단과 해결책을 내놓을 수 있게 된다.

다음 아티클에서는 TCP, Redis, RabbitMQ 등 각 트랜스포터들이 **내부적으로 어떤 차이점**을 가지고 메시지를 전달하는지 비교 분석해 본다.
