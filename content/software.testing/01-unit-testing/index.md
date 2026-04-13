---
title: "단위 테스팅 (Unit Testing) 시리즈"
author: jeffrey
date: 2026-04-13
tags: ["unit-testing", "jest", "mocking", "test-double", "tdd"]
---

## 단위 테스팅: 소프트웨어의 최소 단위를 증명하는 기술

단위 테스팅은 전체 시스템에서 가장 작은 조각(함수, 클래스)을 고립된 환경에서 검증하는 과정입니다. 이 시리즈는 단순히 "함수가 잘 돌아가는가?"를 넘어, 어떻게 하면 **'거짓 양성'** 없는 단단한 유닛 테스트를 설계하고 유지보수할 수 있는지 그 깊은 원리를 다룹니다.

---

### 📚 시리즈 아티클 리스트

1. [단위 테스트의 정의와 고립(Isolation)의 본질](./01-concept-and-isolation.md)
2. [단위 테스트가 비즈니스 자산이 되는 이유](./02-why-unit-testing-matters.md)
3. [Jest와 AAA 패턴으로 시작하는 표준 작성 가이드](./03-how-to-write-with-jest.md)
4. [테스트 더블: Mock, Spy, Stub의 전략적 활용](./04-test-doubles-mocks-spies.md)
5. [실전 사례: NestJS 서비스의 비즈니스 규칙 고립 검증](./05-real-world-nest-service-test.md)

---

> [!IMPORTANT]
> 좋은 단위 테스트는 소스 코드를 수정했을 때만 실패해야 하며, 리팩토링 과정에서는 깨지지 않아야 합니다. 이 시리즈를 통해 **'고통 없는 유닛 테스팅'**의 비결을 확인하십시오.
