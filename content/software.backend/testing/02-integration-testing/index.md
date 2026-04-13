---
title: "통합 테스팅 (Integration Testing) 시리즈"
author: jeffrey
date: 2026-04-13
tags: ["integration-testing", "database-testing", "testcontainers", "infrastructure"]
---

## 통합 테스팅: 조각들이 모여 전체가 되는 순간을 증명하라

단위 테스트가 '개별 보품'의 무결성을 증명한다면, 통합 테스팅은 그 부품들이 서로 맞물려 돌아가는 **'기어(Gear)'**를 확인하는 과정입니다. 이 시리즈는 실제 데이터베이스, 캐시, 외부 API 어댑터와의 유기적인 통신을 어떻게 안정적이고 속도감 있게 검증할 수 있는지 심층적으로 다룹니다.

---

### 📚 시리즈 아티클 리스트

1. [통합 테스트의 정의와 검증 범위: 경계선을 넘어라](./01-concept-and-scope.md)
2. [단위 테스트의 한계를 메우는 통합 테스팅의 필요성](./02-why-integration-testing.md)
3. [실무 가이드: 데이터베이스 연동 테스트와 격리 전략](./03-how-to-impl-database-test.md)
4. [외부 API 어댑터와 타사 서비스 연동 테스팅](./04-testing-external-api-adapters.md)
5. [실전 사례: 복잡한 주문 영속성과 트랜잭션 무결성 검증](./05-real-world-order-persistence.md)

---

> [!TIP]
> 통합 테스팅은 '속도'와 '신뢰도'의 트레이드오프가 가장 심하게 일어나는 영역입니다. 본 시리즈를 통해 **Docker(Testcontainers)** 등을 활용한 최신 통합 테스팅 기법을 습득하십시오.
