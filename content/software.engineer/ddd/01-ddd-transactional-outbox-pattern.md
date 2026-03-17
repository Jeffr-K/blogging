1. Transactional Outbox Pattern: "유실 없는 이벤트 전파"
우리가 이미 만든 domain_events 테이블이 사실상 Outbox 테이블 역할도 수행하게 됩니다.

원칙: 유즈케이스가 dispatcher.dispatch()를 직접 호출하지 않습니다.
프로세스:
리포지토리가 한 트랜잭션 내에서 Aggregate 상태 업데이트 + domain_events 저장을 수행합니다. (완료)
별도의 **Outbox Relay (Worker)**가 백그라운드에서 domain_events 테이블을 감시합니다.
아직 전파되지 않은 이벤트를 읽어와 메시지 브로커(NATS/Kafka)나 인터널 이벤트 핸들러로 쏩니다.
전파가 확실히 성공하면 해당 이벤트에 published_at 타임스탬프를 찍습니다.
이렇게 하면 DB 저장과 이벤트 전파가 원자적으로 묶여 "최소 한 번은 반드시 전송됨(At-least-once delivery)"을 보장합니다.
