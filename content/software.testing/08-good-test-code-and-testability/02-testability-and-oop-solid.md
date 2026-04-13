---
title: "OOP의 SOLID 원칙이 테스트 코드에 미치는 영향"
author: jeffrey
date: 2026-04-13
tags: ["oop", "solid", "dip", "srp", "di", "nestjs", "testable-architecture"]
---

## OOP의 SOLID 원칙이 테스트 코드에 미치는 영향

객체지향 프로그래밍(OOP)에서 **SOLID** 원칙을 지키는 이유는 무엇일까요? 변경에 유연한 설계를 위해서라고 답하곤 하지만, 실전에서는 **"테스트 가능한 설계를 위해서"**라고 해도 과언이 아닙니다. 특히 의존성 관리 전략인 **DIP**와 기능의 단위인 **SRP**는 테스트 코드의 품질을 결정하는 결정적인 요소입니다.

---

### 1. DIP(의존성 역전)와 테스트 고립 (Isolation)

DIP의 핵심은 "구체적인 보다는 추상화에 의존하라"는 것입니다. 이것이 테스트 코드에서 왜 명약일까요?

```typescript
// [Bad] DIP 위반: 구체적인 MySQLRepository에 강하게 결합됨
@Injectable()
export class OrderService {
  constructor(private readonly mysqlRepository: MySQLRepository) {} // 직접 의존

  async checkOrder(id: number) {
    return this.mysqlRepository.findOne(id);
  }
}
```

위 코드로 테스트를 짤 때, `MySQLRepository`를 떼어내기 힘듭니다. 실제 DB 연결 설정이 필요하거나, 복잡한 Mocking 작업이 수반됩니다.

#### 1.1 DIP 기반의 테스트 가능 설계 (Interface 도입)

```typescript
// [Good] DIP 준수: 추상화(Interface/Abstract)에 의존
export interface IUserRepository {
  findById(id: number): Promise<User>;
}

@Injectable()
export class OrderService {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository, // 추상에 의존
  ) {}

  async checkOrder(id: number) {
    return this.userRepository.findById(id);
  }
}
```

이제 테스트에서 `IUserRepository`는 단 한 줄의 Mock 객체(`{ findById: jest.fn() }`)로 교체 가능합니다. 이것이 바로 **테스트 고립(Isolation)**의 정수입니다.

### 2. SRP(단일 책임 원칙)와 테스트 케이스 규모

클래스가 너무 많은 책임을 지면(God Object), 테스트 코드의 `beforeEach`는 비대해지고 `describe` 블록은 수백 줄로 늘어납니다.

- **문제점**: 하나의 기능을 테스트하기 위해 관련 없는 5개의 Mock 객체를 사전에 세팅해야 한다면, 그 설계는 SRP를 위반하고 있다는 강력한 증거입니다.
- **해결**: 책임을 잘게 쪼개면, 테스트 케이스도 작고 명확해집니다. "한 번에 하나만 검증"하는 단위 테스트의 본질을 되찾게 됩니다.

### 3. LSP(리스코프 치환 원칙)와 인프라의 교체 가능성

LSP가 잘 지켜진 설계라면, 테스트 환경에서 사용하는 **메모리 DB(SQLite)**와 운영 환경의 **PostgreSQL**이 동일한 규약대로 작동해야 합니다. 

- 만약 "가짜 DB(Mock)에서는 잘 되는데 진짜 DB에서는 에러가 난다"면, 인터페이스의 행동 규약(Contract)이 깨진 것입니다. 
- **임팩트**: LSP를 준수하는 인터페이스 기반 설계는 테스트 코드의 신뢰도를 실제 운영 환경 수준까지 끌어올립니다.

---

### 4. 시니어의 조언: "DI는 테스트를 위한 배려다"

프레임워크가 제공하는 **의존성 주입(DI)**은 단순히 객체의 생명주기를 관리해 주는 도구가 아닙니다. 

- 그것은 개발자가 테스트 시점에 **"이 부분은 내가 제어하고 싶으니 가짜를 넣어줘"**라고 말할 수 있는 **'열린 통로'**를 제공하는 것입니다. 
- 테스트가 불가능한 코드는 이 통로가 꽉 막힌 거대한 콘크리트 덩어리와 같습니다. 

SOLID를 지키는 것은 당장의 구현 속도를 늦출지 모르나, 프로젝트가 커졌을 때 수만 개의 테스트를 유지보수할 수 있게 해주는 **'엔지니어링의 생명줄'**입니다. 여러분의 클래스가 무엇에 의존하고 있는지 항상 질문하십시오.
