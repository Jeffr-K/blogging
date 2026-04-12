# Microservices Internals (마이크로서비스: 분산 시스템의 내부)

NestJS는 단순히 HTTP 프레임워크가 아니라 서버 사이드 아키텍처 프레임워크입니다. 이 섹션은 NestJS가 지원하는 다양한 전송 계층(Transporter)들이 어떻게 추상화되어 메시지를 주고받는지 파헤칩니다.

## ✨ 왜(Why) 들여다봐야 하나요?

- NestJS가 지원하지 않는 새로운 프로토콜을 위한 '커스텀 트랜스포터'를 직접 만들기 위해.
- 요청-응답(Request-Response)과 이벤트(Event) 방식에서 데이터 패킷이 어떤 경로를 통해 전달되는지 알기 위해.
- 분산 시스템에서 발생하는 직렬화/역직렬화 문제와 패킷 오버헤드를 이해하기 위해.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Transporters**: TCP, Redis, RabbitMQ, Kafka, gRPC가 내부적으로 어떻게 추상화(`CustomTransportStrategy`) 되는지.
- **ClientProxy**: 메시지를 보내는 클라이언트 사이드의 요청 처리 및 응답 대기 메커니즘.
- **Serialization**: 데이터가 네트워크를 타고 흐를 때 사용되는 인코딩/디코딩 전략.
- **Hybrid Application**: HTTP 서버와 마이크로서비스 엔진을 동시에 돌리는 그 이면의 구조.

## 🛠 어떻게(How) 탐구하나요?

- `microservices` 패키지의 `client-proxy.js`, `server.js` 기반의 추상 클래스들 분석.
- 패킷 캡처 도구(Wireshark, tcpdump)를 사용하여 NestJS 간의 통신 패킷을 직접 열어보기.
- `CustomTransportStrategy`를 상속받아 더미(Dummy) 트랜스포터를 만드는 실험 진행.

---

## 📚 관련 아티클 목차

- [01. NestJS 마이크로서비스 엔진: 추상화 인터페이스 이해](./microservice-engine-abstraction.md) (작성 예정)
- [02. ClientProxy: 비동기 메시지 응답을 기다리는 스마트한 방법](./client-proxy-internals.md) (작성 예정)
- [03. TCP, Redis, RabbitMQ 트랜스포터의 내부 구현 차이점](./transporters-comparison.md) (작성 예정)
- [04. 실전: 커스텀 트랜스포터를 직접 구현하여 전용 프로토콜 연동하기](./custom-transporter-implementation.md) (작성 예정)
