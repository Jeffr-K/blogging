---
title: "NestJS Deep Dive: 커스텀 트랜스포터 직접 구현 가이드"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "custom-transporter", "microservices", "design-patterns"]
---

## 프레임워크의 경계를 허물다: 커스텀 트랜스포터

NestJS는 수많은 트랜스포터를 기본 제공하지만, 세상에는 더 다양한 통신 방식이 존재한다. NATS, Google Cloud Pub/Sub, 또는 우리 팀만의 고유한 TCP 프로토콜을 사용해야 한다면 어떻게 해야 할까?

이번 아티클에서는 `CustomTransportStrategy`와 `ClientProxy` 추상 클래스를 상속받아, **세상에 없는 새로운 전송 프로토콜**을 NestJS 마이크로서비스 엔진에 완벽하게 통합하는 과정을 딥다이브해 본다.

---

## 1. 서버 사이드: CustomTransportStrategy 구현

가장 먼저 서버가 외부로부터 메시지를 수신하는 통로를 정의해야 한다.

```typescript
export class MyCustomServer extends Server implements CustomTransportStrategy {
  // 1. 서버 시작 시 실행되는 로직
  public listen(callback: () => void) {
    this.initMyChannel(); // 프로토콜별 실제 소켓/연결 초기화
    callback();
  }

  // 2. 메시지 수신 시 핸들러와 연결하는 로직
  private onMessage(packet: any) {
    const pattern = JSON.stringify(packet.pattern);
    const handler = this.getHandlerByPattern(pattern);
    
    if (!handler) {
      return this.sendError('Handler not found', packet);
    }
    
    // 3. 핸들러 실행 및 응답 반환
    return handler(packet.data);
  }

  public close() {
    this.cleanupMyChannel();
  }
}
```

---

## 2. 클라이언트 사이드: ClientProxy 확장

애플리케이션 내의 다른 서비스가 우리 프로토콜로 메시지를 보낼 수 있도록 클라이언트 대리자를 정의한다.

```typescript
export class MyCustomClient extends ClientProxy {
  // 1. 실제 패킷을 전송하는 핵심 메서드 구현
  protected dispatchEvent(packet: ReadPacket): Promise<any> {
    // 이벤트 기반 (응답 필요 없음) - 패킷 전송 후 종료
    return this.sendMyPacket(packet);
  }

  protected publish(packet: ReadPacket, callback: (packet: WritePacket) => void): () => void {
    // 요청-응답 방식 - 응답 콜백(callback)을 관리해야 함
    const correlationId = packet.id;
    this.registerResponseCallback(correlationId, callback);
    this.sendMyPacket(packet);
    
    // 리소스 정리 함수 반환
    return () => this.unregisterResponseCallback(correlationId);
  }
}
```

---

## 3. 패킷 직렬화와 역직렬화 (Serialization)

커스텀 트랜스포터 제작 시 가장 중요한 지점은 **패킷 포맷**이다.

- **Serializer**: 클라이언트가 네트워크로 쏠 때 데이터 가공.
- **Deserializer**: 서버가 네트워크에서 받은 무작위 바이너리를 객체로 복원.

이 과정을 통해 JSON 뿐만 아니라 Protobuf, MessagePack 등으로 통신 성능을 최적화할 수 있다.

---

## 4. 실전 통합: main.ts 설정

커스텀 전략을 정의했다면, `NestFactory`에 주입하기만 하면 된다.

```typescript
const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
  strategy: new MyCustomServer(), // 여기에 우리 커스텀 서버 전략 투입!
});
await app.listen();
```

---

## 요약: 커스텀 트랜스포터가 주는 자유

커스텀 트랜스포터를 직접 구현하는 것은 NestJS 마이크로서비스 엔진의 **'추상화 원격 제어'** 능력을 극대화하는 작업이다.

- `CustomTransportStrategy`를 통한 서버 수명주기 관리
- `ClientProxy`를 통한 비동기 요청-응답 패턴 커스터마이징
- 독자적인 패킷 통신 규격 확립

이제 우리는 프레임워크가 제공하는 도구에 갇히지 않고, 어떤 외부 시스템과도 유연하게 대화할 수 있는 강력한 무기를 갖게 되었다.

이로써 마이크로서비스 테마를 완벽하게 정복했다. 다음 테마는 비즈니스 로직의 복잡성을 해결하기 위해 새롭게 추가된 **CQRS 패키지의 내부 딥다이브**다.
