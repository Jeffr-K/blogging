---
title: "NestJS Deep Dive: CQRS 실전 패턴 — 에러 핸들링과 트랜잭션"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "cqrs", "error-handling", "transactional", "best-practices"]
---

## 마침내 하나가 되다: 성공적인 CQRS 운영을 위한 전략

지금까지 `CommandBus`, `QueryBus`, `ExplorerService`, `Sagas` 등 CQRS의 모든 내부 부품들을 살펴보았다. 하지만 실무에 이를 적용할 때 가장 큰 난관은 아이러니하게도 기초적인 **에러 핸들링(Error Handling)**과 **트랜잭션(Transaction)**의 관리다.

버스를 타고 비동기로 날아간 커맨드가 실패하면, 이를 호출한 컨트롤러는 어떻게 그 에러를 알 수 있을까? 하나의 커맨드가 여러 엔티티를 고칠 때 트랜잭션은 어떻게 묶어야 할까? 이번 최종 아티클에서는 **실전 CQRS 아키텍처**를 위한 에러와 트랜잭션 관리 전략을 딥다이브해 본다.

---

## 1. 커맨드 실패와 에러 전파 (Error Propagation)

`CommandBus.execute()`는 기본적으로 **Promise**를 반환한다.

- 만약 핸들러 내에서 `throw new ConflictException()`이 발생하면, 이 에러는 `execute()`를 호출한 호출부(Service 또는 Controller)로 다시 전파된다.
- 따라서 커스텀 필터와 가드를 사용하여, 컨트롤러 계층에서 일반적인 API 요청과 동일하게 에러를 처리할 수 있다.

**주의사항**: 사가(`Sagas`)는 비동기로 이벤트를 관찰하므로, 사가 내부에서 특정 커맨드가 실패하면 그 에러가 최초 요청자에게 전달되지 않는다. 이 경우 **'실패 이벤트(Error Event)'**를 따로 발행하여 상태를 원복하거나 로그를 남겨야 한다.

---

## 2. 도메인 트랜잭션: 유닛 오브 워크(UoW)와 데코레이터

커맨드 핸들러에서 여러 엔티티를 수정할 때, 이들을 하나의 트랜잭션으로 묶는 것은 데이터 무결성을 위해 필수다.

### 전략 A: 핸들러 내 수동 트랜잭션

```typescript
@CommandHandler(CreateUserCommand)
async execute(command: CreateUserCommand) {
  return await this.entityManager.transactional(async (em) => {
    // 1. 유저 생성 로직
    // 2. 포인트 지급 로직
    // ... 모두 성공해야 커밋
  });
}
```

### 전략 B: @Transactional() 커스텀 데코레이터

앞서 배운 메타데이터와 인터셉터 지식을 활용하여, 핸들러에 `@Transactional()`만 붙여도 자동으로 트랜잭션이 시작되고 종료되도록(Commit/Rollback) 아키텍처를 고도화할 수 있다. (MikroORM 등과 결합 시 매우 강력하다.)

---

## 3. 이벤트 배포 시점 (Dispatching Events)

엔티티가 이벤트를 남길 때, 실제 DB 트랜잭션이 **커밋(Commit)되기 전에 이벤트를 쏘면** 안 된다.

- 만약 이벤트가 먼저 나갔는데 DB 저장에서 에러가 나면, 시스템의 데이터(DB)와 메시지(Event) 사이의 불일치가 발생한다.
- **해결책**: 트랜잭션이 완전히 종료된 후(After Commit)에만 쌓여있는 도메인 이벤트를 `EventBus`를 통해 발행하는 훅(Hook)을 인터셉터나 데코레이터로 구현하는 것이 정석이다.

---

## 4. 실전 패턴: Outbox Pattern 맛보기

네트워크 장애로 인해 이벤트 유실을 방지하려면, DB 트랜잭션의 일부로 **기록될 이벤트 자체를 DB 테이블(Outbox Table)**에 함께 저장하는 **Transactional Outbox Pattern**을 고려해 보자.

NestJS의 `EventBus`를 상속받아 이 패턴을 구현하면, 프레임워크의 유연함과 시스템의 견고함을 동시에 얻을 수 있다.

---

## 요약: CQRS의 마침표

CQRS는 화려한 데코레이터와 클래스 뒤에 숨겨진 **철저한 책임 분리**와 **데이터 일관성 유지**가 본질이다.

- 에러 전파의 경로를 명확히 설계하자.
- 트랜잭션의 범위는 커맨드 핸들러 단위를 넘지 않도록 주의하자.
- 이벤트 발행 시점은 항상 데이터 저장 완료 이후여야 함을 잊지 말자.

이제 CQRS 테마의 모든 딥다이브를 마무리했다. 이 9개의 섹션을 통해 우리는 NestJS의 겉모습만이 아니라, 그 안에서 소용돌이치는 데이터와 메시지의 흐름을 완전히 장악하게 되었다.

지금까지 고생 많으셨습니다. 이제 다음 테마인 **RxJS와 비동기 데이터 스트림**의 심연으로 발걸음을 옮겨 봅시다.
