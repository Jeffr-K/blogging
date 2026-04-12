---
title: "NestJS Deep Dive: 마이크로서비스 엔진 추상화 인터페이스 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "microservices", "abstraction", "internals"]
---

## 분산 시스템의 언어: 마이크로서비스 추상화

NestJS의 가장 강력한 지점 중 하나는 **"어떤 전송 프로토콜(Transporter)을 쓰든 동일한 코드로 백엔드 로직을 작성할 수 있다"**는 점이다. TCP, Redis, RabbitMQ, Kafka, gRPC — 이 상이한 통신 방식을 하나로 묶어주는 거대한 추상화 레이어가 NestJS 마이크로서비스 엔진의 정체다.

이번 아티클에서는 `CustomTransportStrategy`를 기반으로, NestJS가 어떻게 다양한 네트워크 프로토콜을 통일된 인터페이스로 래핑(Wrapping)하는지 딥다이브해 본다.

---

## 1. 마이크로서비스 엔진의 두 축: Client와 Server

NestJS 마이크로서비스는 크게 두 가지 핵심 추상 클래스로 나뉜다.

1. **Server (서버)**: 들어오는 메시지를 수신하고, 적절한 핸들러(`@MessagePattern`, `@EventPattern`)로 연결한다. (`CustomTransportStrategy` 인터페이스 구현체)
2. **ClientProxy (클라이언트)**: 원격 마이크로서비스에 메시지를 보내고, 응답을 기다린다.

---

## 2. CustomTransportStrategy: 서버 인터페이스

우리가 새로운 전송 방식을 정의하려면, `CustomTransportStrategy` 인터페이스를 구현해야 한다.

- **listen(callback)**: 서버를 가동하고 메시지 수신 대기를 시작한다.
- **close()**: 서버 연결을 종료하고 리소스를 정리한다.

### 딥다이브: 메시지 수신과 역직렬화 (Deserialization)

서버가 메시지를 받으면, 가장 먼저 하는 일은 바이너리(또는 텍스트) 데이터를 NestJS가 인식할 수 있는 **메시지 패킷 객체**로 변환하는 것이다.

```typescript
// NestJS 표준 메시지 패킷 구조
{
  pattern: 'user.created',
  data: { id: 1, name: 'Alice' },
  id: 'unique_request_id' // 요청-응답 방식일 경우 필수
}
```

---

## 3. 요청-응답(Request-Response) vs 이벤트(Event)

- **Request-Response**: `id` 필드가 포함된 패킷을 사용하여, 클라이언트가 특정 응답을 기다리는 양방향 통신이다. (`@MessagePattern`)
- **Event-based**: 응답이 필요 없는 단방향 통신이다. `id`가 없는 패킷을 사용한다. (`@EventPattern`)

NestJS 엔진은 패킷 내부의 `id` 유무를 확인하여, 자동으로 적절한 핸들러 타입(`MessagePattern` 또는 `EventPattern`)을 결정하고 실행한다.

---

## 4. 메시지 핸들러 레지스트리 (Handler Registry)

서버는 내부적으로 **핸들러 맵(`Map`)**을 관리한다. 애플리케이션 시작 시 `DependenciesScanner`가 찾은 `@MessagePattern` 이름과 실제 핸들러 함수를 이 맵에 등록해 둔다.

- 메시지가 도착하면 패킷의 `pattern` 이름을 키로 맵에서 핸들러를 찾는다.
- 발견되면 실행하고, 결과물을 다시 적절한 프로토콜 포맷으로 감싸서 돌려주는 일련의 파이프라인이 동작한다.

---

## 요약

NestJS 마이크로서비스 엔진은 **"모든 네트워크 통신은 결국 패킷 기반의 메시지 전달"**이라는 본질을 꿰뚫는 설계를 가지고 있다.

- `CustomTransportStrategy`를 통해 다양한 프로토콜을 유연하게 수용하자.
- 표준 메시지 패킷 구조를 이해하여, 타 언어나 시스템과의 상호운용성을 확보하자.
- 요청-응답과 이벤트 기반 방식의 내부 처리 차이를 명확히 인지하자.

이 추상화 레이어를 깊이 이해하면, 향후 어떤 복잡한 분산 시스템 환경에서도 흔들리지 않는 견고한 아키텍처를 설계할 수 있게 된다.

다음 아티클에서는 클라이언트 사이드에서 비동기 메시지 응답을 똑똑하게 기다리는 **`ClientProxy`의 내부 메커니즘**을 파헤쳐 본다.
