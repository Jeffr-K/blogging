---
title: "객체지향 설계와 테스팅 (OOP & Testability) 시리즈"
author: jeffrey
date: 2026-04-13
tags: ["oop", "solid", "dependency-injection", "design-patterns", "testability"]
---

## 객체지향 설계와 테스팅: 견고한 객체망을 검증하는 기술

객체지향 프로그래밍(OOP)에서의 테스팅은 객체 간의 **'협력'**과 **'고립'** 사이의 줄타기입니다. 이 시리즈는 SOLID 원칙이 어떻게 테스트 가능한 구조를 만드는지, 그리고 전략(Strategy), 데코레이터(Decorator) 등의 디자인 패턴이 테스트 코드 상에서 어떻게 유연한 Mocking 포인트가 되는지 심층적으로 다룹니다.

---

### 📚 시리즈 아티클 리스트

1. [SOLID 원칙: 테스트 가능한 객체 설계의 5가지 이정표](./01-concept-solid-and-testability.md)
2. [의존성 주입(DI)과 IoC 컨테이너가 테스팅의 왕인 이유](./02-why-di-and-ioc-are-test-enablers.md)
3. [디자인 패턴과 테스팅: 전략, 팩토리, 템플릿 메서드 활용법](./03-how-to-impl-design-patterns-for-test.md)
4. [데코레이터와 프록시 패턴: 횡단 관심사 테스팅 전략](./04-testing-decorator-and-proxy-patterns.md)
5. [실전 사례: 복잡한 NestJS 서비스 아키텍처의 OOP 기반 검증](./05-real-world-nest-oop-architecture-test.md)

---

> [!IMPORTANT]
> OOP에서의 테스트 가능성은 **'다형성(Polymorphism)'**을 얼마나 잘 활용하여 테스트 타임에 구현체를 갈아 끼울 수 있느냐에 달려 있습니다.
