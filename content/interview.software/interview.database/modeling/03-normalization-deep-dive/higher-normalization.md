---
title: "DB Modeling: 고차 정규화(4NF, 5NF) — 다치 종속과 조인 종속"
author: jeffrey
date: 2026-04-06
tags: ["db-modeling", "normalization", "4NF", "5NF", "multi-valued-dependency", "join-dependency"]
---

## 이론의 끝: 고차 정규화(Advanced Normalization)

우리는 보통 제3정규형(3NF) 수준에서 모델링을 마무리한다. 하지만 아주 복잡한 3파전 이상의 관계가 얽혀 있을 때, 3NF만으로는 해결되지 않는 데이터 중복이 존재한다. 이때 필요한 것이 **4정규형(4NF)**과 **5정규형(5NF)**이다.

이론의 영역에 가깝지만, 다치 종속(Multi-valued Dependency)과 조인 종속(Join Dependency)을 이해하는 것은 데이터의 물리적 결합을 완벽하게 해체하는 최상급 기술이다. 이번 아티클에서는 고차 정규화의 본질을 딥다이브해 본다.

---

## 1. 딥다이브: 제4정규형 (4NF) — 다치 종속 (MVD)

- **상황**: 한 사람(User)이 여러 취미(Hobby)를 가지고 있고, 여러 기술(Skill)도 가지고 있다고 가정하자. (취미와 기술은 서로 관계가 없다.)
- **문제**: 이를 한 테이블에 담으면 `(User, Hobby, Skill)` 형태가 되어, 한 취미가 늘어날 때마다 모든 기술에 대해 행을 복사해야 하는 기하급수적 중복이 발생한다. 이를 **다치 종속(Multi-valued Dependency)**이라 부른다.
- **해결**: 관련 없는 독립적인 두 다치(Multi-value) 관계를 각각 독립적인 테이블 `(User, Hobby)`와 `(User, Skill)`로 떼어낸다.

### [4NF 실전 매핑]

**SQL DDL (Decomposed)**

```sql
-- 분리 전: User_Info(id, hobby, skill) -> 기술 하나 추가할 때마다 취미 행이 복사됨

-- 4NF 적용 후: 독립적인 두 관계로 분리
CREATE TABLE User_Hobbies (
    user_id BIGINT NOT NULL,
    hobby VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, hobby)
);

CREATE TABLE User_Skills (
    user_id BIGINT NOT NULL,
    skill VARCHAR(50) NOT NULL,
    PRIMARY KEY (user_id, skill)
);
```

```typescript
@Entity()
export class User {
  @PrimaryKey()
  id!: number;

  // 관련 없는 두 컬렉션을 독립적으로 관리
  @OneToMany(() => UserHobby, (h) => h.user)
  hobbies = new Collection<UserHobby>(this);

  @OneToMany(() => UserSkill, (s) => s.user)
  skills = new Collection<UserSkill>(this);
}

@Entity()
export class UserHobby {
  @ManyToOne({ primary: true })
  user!: User;

  @Property({ primary: true })
  hobby!: string;
}
```

---

## 2. 딥다이브: 제5정규형 (5NF) — 조인 종속 (JD)

- **상황**: 다치 종속에서 한 단계 더 나아가 세 개 이상의 속성이 서로 **순환적인 관계**를 맺고 있을 때 발생한다 (예: 대리점, 상품, 제조사).
- **문제**: 테이블을 두 개로 쪼개서 다시 조인했을 때, 원래는 없던 가상의 데이터(Spurious Tuple)가 생겨나는 경우다.
- **해결**: 원래 테이블을 세 개 이상의 테이블로 쪼개어 무손실 분해를 증명해야 한다. 만약 원래 정보를 복구하는 유일한 방법이 원본을 그대로 두는 것이라면 정규화는 멈춘다.

### [5NF 실전 매핑]

**SQL DDL (Decomposed)**

```sql
-- (대리점, 제조사, 상품) 3개 속성이 얽힌 경우
-- 조건: 대리점 A가 제조사 B의 상품 C를 팔려면, A는 B와 계약 중이어야 하고 A는 C를 취급해야 하며 B는 C를 생산해야 함.

CREATE TABLE Agent_Company (
    agent_id INT, 
    company_id INT, 
    PRIMARY KEY (agent_id, company_id)
);

CREATE TABLE Company_Product (
    company_id INT, 
    product_id INT, 
    PRIMARY KEY (company_id, product_id)
);

CREATE TABLE Agent_Product (
    agent_id INT, 
    product_id INT, 
    PRIMARY KEY (agent_id, product_id)
);
```

**MikroORM v7 매핑**

```typescript
// 5NF 수준의 연관관계는 대개 독립적인 교차 엔티티로 표현됩니다.
@Entity()
export class AgentCompanyRelation {
  @ManyToOne({ entity: () => Agent, primary: true })
  agent!: Agent;

  @ManyToOne({ entity: () => Company, primary: true })
  company!: Company;
}

// 나머지 (CompanyProduct, AgentProduct) 또한 독립적으로 설계하여 
// 3자 간의 불필요한 곱집합 중복을 물리적으로 차단합니다.
```

---

## 3. 실무적 의의: 왜 3NF에서 멈추는가?

4NF와 5NF를 실무에 도입하는 경우는 드물다.

- **조인 비용의 폭주**: 테이블이 잘개 쪼개질수록 조인의 수가 급격히 늘어나 시스템 성능이 파괴된다.
- **유지보수 난이도**: 설계가 너무 복잡해져서 쿼리를 한 번 날릴 때마다 작성해야 하는 코드량이 방대해진다.

---

## 요약

고차 정규화는 **"데이터의 독립성을 극한까지 추구하는 철학"**이다.

- 다치 종속(4NF)은 관련 없는 N개의 리스트들을 강제로 한 테이블에 넣지 말아야 함을 가르쳐준다.
- 조인 종속(5NF)은 쪼갠 뒤 다시 합쳤을 때 원형이 유지되는지(무손실 분해)를 검증하는 최종 관문이다.
- 실무에서는 **성능과 정규화 사이의 타협점**을 찾는 지능적인 설계가 고차 정규화 이론보다 강력할 때가 많다.

이 고차원적인 이론까지 습득했다면, 이제 드디어 성능을 위해 정규화의 원칙을 깨는 기술인 **반정규화(Denormalization)의 결정 시점**을 딥다이브할 준비가 된 것이다.
