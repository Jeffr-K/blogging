---
title: "[DB Master] 2. 논리적 모델링 — 정규화와 관계의 엄밀함 구축하기"
author: jeffrey
date: 2026-04-07
tags: ["db-modeling", "logical-modeling", "normalization", "1nf", "2nf", "3nf", "bcnf", "4nf", "5nf", "mapping", "inheritance"]
---

## 논리적 모델링: 개념을 구조로, 구조를 규칙으로

개념적 모델링에서 비즈니스의 지평선을 그렸다면, **논리적 모델링(Logical Modeling)**은 그 지도를 실제 **관계형 데이터베이스(RDBMS)**가 한 치의 오차 없이 이해할 수 있도록 표(Table)의 형태로 정교하게 다듬는 과정입니다.

엔지니어링의 세계에서 논리 모델링의 성패는 **"얼마나 엄밀하게 데이터를 찢어서 무결성을 지켰는가"**에 달려 있습니다. 이 과정은 단순히 표를 만드는 수준을 넘어, 데이터의 **함수적 종속성(Functional Dependency)**을 분석하고, 미래에 발생할 수 있는 모든 데이터 오염(Anomaly)을 사전에 차단하는 고도의 지적 작업입니다.

---

## 1. [Master's Topic] 식별자(Identifier)의 전략적 선정

개념 모델에서 추출된 식별자는 논리 모델에서 **기본키(Primary Key)**로 승격됩니다. 이 선택은 해당 테이블뿐만 아니라 이를 참조하는 모든 자식 테이블의 조인 성능을 결정짓는 운명적인 결정입니다.

### 1.1 자연 키(Natural Key) vs 인용 키(Surrogate Key)

- **자연 키**: 비즈니스 의미를 가진 값 (예: 사번, 주문번호).
- **인공 키**: 시스템에서 생성하는 무의미한 순번 (예: `id` + `AUTO_INCREMENT`).

> **💡 기술전수자의 철학**: 기필코 **인공 키**를 기본키로 삼으십시오. 자연 키(이메일 등)는 비즈니스 정책의 변화나 개인정보 보호법의 강화로 인해 언제든 변경될 수 있습니다. PK가 바뀌면 이를 참조하는 모든 FK(Foreign Key)를 연쇄적으로 업데이트해야 하며, 이는 대규모 시스템에서 재앙에 가까운 부하를 일으킵니다. 자연 키는 유니크 인덱스(Unique Index)로 별도 관리하는 것이 시니어의 정석입니다.

### 1.2 기본키의 3대 물리적 특징

1. **Not Null**: 반드시 값이 존재해야 함.
2. **Unique**: 유일해야 함.
3. **Immutability**: 절대 변하지 않아야 함.

---

## 2. [Workshop] 정규화(Normalization): 이상 현상과의 전면전

정규화는 데이터의 군살을 걷어내어 **중복**을 물리적으로 제거하는 과정입니다. 면접에서는 3NF까지만 묻지만, 설계자라면 **BCNF**와 **4NF**, **5NF**의 그림자까지 알고 있어야 합니다.

여기에 하나의 거대한 **'주문상세집계'** 테이블이 있다고 가정하고 단계별로 찢어 보겠습니다.

```text
[초기 비정규 테이블: OrderSummary]
- 주문ID, 고객ID, 고객명, 등급, 상품ID, 상품명, 수량, 가격, 태그(쉼표로 구분), 제조사명, 제조사주소
```

### 2.1 제1정규형 (1NF): 원자 값(Atomic Value)의 확보

- **문제**: `태그` 칼럼에 `"신선,인기,할인"` 처럼 리스트가 들어있습니다.
- **이상 현상**: 특정 태그별로 그룹핑하거나 조회할 때 `LIKE` 검색을 남발해야 하므로 인덱싱이 불가능합니다.
- **해결**: 태그를 별도의 `Order_Tag` 테이블로 뺍니다. 이제 각 태그는 하나의 행(Row)을 차지합니다.

### 2.2 제2정규형 (2NF): 부분 함수 종속성 제거

- **정의**: PK가 (주문ID, 상품ID)인 복합키일 때, 일반 속성이 키의 '일부'에만 의존해선 안 됩니다.
- **문제**: `고객명`과 `등급`은 `주문ID`에만 종속되며, `상품명`은 `상품ID`에만 종속됩니다.
- **이상 현상 (삽입 이상)**: 새로운 상품을 등록하고 싶은데, 주문이 발생하기 전까지는 상품 정보를 넣을 자리가 없습니다.
- **해결**: `Members`와 `Products` 테이블을 완전히 분리합니다.

### 2.3 제3정규형 (3NF): 이행적 함수 종속성 제거

- **정의**: PK -> 속성1 -> 속성2 와 같은 건너뛰기 종속을 금지합니다.
- **문제**: `상품ID` -> `제조사명` -> `제조사주소` 구조에서, `제조사주소`는 제조사명에 종속됩니다.
- **이상 현상 (수정 이상)**: 제조사 주소가 바뀌면 이 제조사가 만든 수천 개의 상품 행을 모두 업데이트해야 합니다. 하나라도 놓치면 데이터 정합성이 무너집니다.
- **해결**: `Manufacturers` 테이블을 따로 분리합니다.

### 2.4 BCNF (보이스-코드 정규형): 결정자는 후보키여야 함

- **상황**: 교수가 여러 과목을 가르치고, 학생은 여러 과목을 수강하는데, 특정 과목은 단 한 명의 교수만 가르치는 복잡한 복합키 상황.
- **해결**: 모든 '결정자'가 후보키의 역할을 수행하도록 더 정교하게 테이블을 쪼갭니다. 3NF의 미세한 사각지대를 메우는 최종 단계입니다.

### 2.5 [Advanced] 4NF & 5NF: 다치 종속과 조인 종속

- **4NF (다치 종속)**: 한 사람이 여러 취미를 가지고 여러 언어를 구사할 때, 취미와 언어는 관련이 없는데 한 테이블에 두 리스트가 공존하면 행 수가 기하급수적으로 늘어납니다 (Cartesian Product 발생). 이를 분리하는 것이 4NF입니다.
- **5NF (조인 종속)**: 쪼개진 테이블들을 다시 조인했을 때 원래 없던 '가상 데이터(Spurious Tuple)'가 생겨나지 않도록 분해하는 최종적인 무손실 분해 단계입니다.

---

## 3. 관계 매핑의 정화: 식별 vs 비식별의 결단

부모의 PK를 자식에게 어떻게 물려줄 것인가의 문제입니다.

### 3.1 식별 관계 (Identifying Relationship)

- **정의**: 부모의 PK가 자식의 PK 구성원이 됨.
- **실전 팁**: 부모와 자식의 생명 주기가 완벽히 일치할 때(예: `Account` - `Account_Log`) 사용합니다. 조인을 할 때 별도의 FK 칼럼 조회 없이 자식의 PK만으로 부모 ID를 알 수 있어 조인 성능 향상에 기여합니다. (하지만 PK가 점점 길어지는 단점이 있음)

```sql
-- 부모 테이블
CREATE TABLE Account (
    account_id VARCHAR(20) PRIMARY KEY, -- 부모의 PK
    owner_name VARCHAR(50) NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0
);

-- 자식 테이블 (식별 관계)
CREATE TABLE Account_Log (
    account_id VARCHAR(20),            -- 부모의 PK를 가져옴 (FK)
    log_seq INT,                       -- 자체 일련번호
    log_message TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY (account_id, log_seq), -- 부모 PK + 자체 컬럼을 묶어서 PK로 설정
    FOREIGN KEY (account_id) REFERENCES Account(account_id)
);
```

```java
@Entity
public class Account {
    @Id
    @Column(name = "account_id")
    private String id;

    private String ownerName;
    private Long balance;
}

@Entity
@IdClass(AccountLogId.class) // 복합키 클래스 지정
public class AccountLog {

    @Id
    @ManyToOne
    @JoinColumn(name = "account_id")
    private Account account; // 부모의 PK를 자신의 PK로 사용 (식별 관계)

    @Id
    private Integer logSeq;

    private String logMessage;
}

@Data // Getter, Setter, RequiredArgsConstructor, ToString, EqualsAndHashCode 한꺼번에 적용
// @EqualsAndHashCode
// @Getter
@NoArgsConstructor // JPA 엔티티/IdClass는 기본 생성자가 필수입니다.
@AllArgsConstructor // 모든 필드를 파라미터로 받는 생성자 (객체 생성 시 편리)
public class AccountLogId implements Serializable {
    private String account; // AccountLog 엔티티의 필드명과 동일해야 함
    private Integer logSeq;
}
```

```typescript
@Entity()
export class Account {
  @PrimaryKey()
  id!: string;

  @Property()
  ownerName!: string;

  @Property()
  balance: number = 0;
}

@Entity()
export class AccountLog {
  @ManyToOne({ entity: () => Account, primary: true }) // 부모 PK를 자신의 PK로 사용
  account!: Account;

  @PrimaryKey() // 자신만의 PK 구성원
  logSeq!: number;

  @Property()
  logMessage!: string;

  @Property()
  createdAt: Date = new Date();
}
```

- **조인 성능**: `Account_log` 테이블만 조회해도 이 로그가 어떤 account_id 에 속해 있는지 즉시 알 수 있다. 따라서 조인 시 별도의 FK 칼럼 조회 없이 자식의 PK만으로 부모 ID를 알 수 있어 조인 성능 향상에 기여한다.
- **저장 시 주의**: 자식은 부모 없 이슈 존재할 수 없으므로, 반드시 `Account` 객체가 먼저 존재해야 `Account_log` 를 저장할 수 있다.
- **PK 비대화**: 만약 `Account_log` 아래에 또 다른 자식인 `Log_Detail` 이 식별 관계로 연결된다면 그 테이블의 `PK` 는 `(account_id, log_seq, log_detail_seq)` 가 되어 점점 길어지고 무거워진다. 이럴 땐 비식별 관계로 변경하는 것을 고려해야 한다.

### 3.2 비식별 관계 (Non-identifying Relationship)

- **정의**: 부모의 `PK` 가 자식의 일반 `FK` 칼럼으로 전이됨.
- **실전 팁**: 대부분의 현대적 DB 설계에서 권장됩니다. 데이터 구조의 유연성을 확보하고, `PK` 의 크기를 작게 유지하여 인덱스의 효율을 높입니다.

```sql
-- 부모 테이블 (Department: 부서)
CREATE TABLE Department (
    dept_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    dept_name VARCHAR(100) NOT NULL
);

-- 자식 테이블 (Employee: 직원, 비식별 관계)
CREATE TABLE Employee (
    emp_id BIGINT PRIMARY KEY AUTO_INCREMENT, -- 자신만의 독립적인 PK
    dept_id BIGINT,                           -- 부모의 PK가 일반 FK로 전이
    emp_name VARCHAR(50),
    FOREIGN KEY (dept_id) REFERENCES Department(dept_id)
);
```

```typescript
@Entity()
export class Department {
  @PrimaryKey()
  deptId!: number;

  @Property()
  deptName!: string;
}

@Entity()
export class Employee {
  @PrimaryKey()
  empId!: number;

  @Property()
  empName!: string;

  @ManyToOne({ entity: () => Department }) // 부모의 PK가 일반 FK로 전이
  department!: Department;
}
```

- **데이터 변경의 유연성**: 식별 관계에서는 부모가 바뀌면 자식의 `PK` 도 변경되어야 한다. 만약 직원이 부서 이동을 할 때, 식별 관계라면 `emp_id` 자체가 변경되어야 하는 불상사가 발생한다. 하지만 비식별 관계라면 `dept_id` 만 변경하면 되므로 훨씬 유연하다.
- **PK 인덱스 최적화**: 식별 관계는 계층이 깊어질수록 `PK` 가 비대해진다. 이는 모든 인덱스 크기를 키우고 메모리 효율을 떨어뜨리게 된다. 비식별 관계는 모든 테이블이 단순한 `PK`(예: `Long id`)를 가지므로 인덱스 구조가 단순하고 가볍다.
- **객체 지향 모델링과의 조화**: `JPA` 나 `MikroORM` 같은 `ORM` 도구들은 대게 단일 식별자(`Surrogate Key`, 대리키)를 사용하는 모델에서 매끄럽게 동작하기 때문이다. 복합키 클래스를 매번 만들지 않아도 되므로 생산성이 크게 향상된다.

---

## 4. [Deep Dive] 상속 관계(Generalization)의 논리 모델 매핑

개념 모델의 `Member(Individual/Corporate)` 상속 구조를 어떻게 표로 만들 것인가? 여기엔 정답이 없고 **트레이드오프**만 있습니다.

### 방법 1. Single Table Strategy (하나로 합치기)

- **구조**: `Members` 테이블에 모든 컬럼을 넣고 `member_type` 추가.
- **장점**: 조인이 아예 없어 조회 성능이 가장 빠름.
- **단점**: 특정 타입에만 필요한 칼럼에 `NULL`이 가득 차며 테이블이 뚱뚱해짐 (`Sparse table`).

```typescript
@Entity({
  discriminatorColumn: 'type', // 타입을 구분할 컬럼명
  abstract: true,
})
export abstract class Member {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;
}

@Entity()
export class IndividualMember extends Member {
  @Property({ nullable: true }) // 다른 타입일 땐 NULL이 되므로 nullable 필수
  ssn?: string;
}

@Entity()
export class CorporateMember extends Member {
  @Property({ nullable: true })
  businessRegistrationNumber?: string;
}
```

### 방법 2. Joined Table Strategy (정규화의 정석)

- **구조**: `Members`(공통), `Individual_Members`(개별), `Corporate_Members`(개별)로 분리.
- **장점**: 저장 공간 절약이 극대화되고 무결성 체크가 쉬움.
- **단점**: 멤버 정보를 한눈에 보려면 반드시 **JOIN**이 발생하여 CPU 부하 가중.

```typescript
// 공통 데이터는 부모에, 상세 데이터는 자식 테이블에 나누고 PK를 공유(식별 관계)하는 방식
// 실전 느낌: "데이터는 깔끔하게 나눠야지! 필요할 때 JOIN 해서 쓰자."
// 코드 특징: DB 설계가 가장 정석적. 자식 테이블의 PK가 부모 테이블의 PK를 참조하는 식별 관계가 자동으로 형성.
@Entity({ inheritanceStrategy: InheritanceType.JOINED })
export abstract class Member {
  @PrimaryKey()
  id!: number;

  @Property()
  email!: string;
}

@Entity()
export class IndividualMember extends Member {
  @Property()
  ssn!: string; // 여기선 필수값(NOT NULL) 설정 가능
}

@Entity()
export class CorporateMember extends Member {
  @Property()
  businessRegistrationNumber!: string;
}
```

### 방법 3. Table per Concrete Class (완전 분리)

- **구조**: 공통 테이블 없이 `Individual_Members`, `Corporate_Members`만 유지.
- **장점**: 각 도메인의 독립성 최강.
- **단점**: 전체 회원 목록을 뽑으려면 `UNION` 쿼리를 써야 하는 끔찍한 상황 발생.

```typescript
// 부모 테이블은 아예 만들지 않고, 자식들만 각각의 테이블을 가지는 방식
// 실전 느낌: "공통점은 코드에서만 찾고, DB는 아예 남남으로 가자."
// 코드 특징: Member 타입으로 전체 조회를 하면 내부적으로 UNION 쿼리가 날아갑니다. ORM 레벨에서는 편해 보이지만 DB 입장에서는 성능 최적화가 가장 어렵
@Entity({ inheritanceStrategy: InheritanceType.TABLE_PER_CLASS })
export abstract class Member {
  @PrimaryKey()
  id!: number; // 각 테이블마다 ID 시퀀스를 관리해야 할 수도 있음

  @Property()
  email!: string;
}

@Entity()
export class IndividualMember extends Member {
  @Property()
  ssn!: string;
}

@Entity()
export class CorporateMember extends Member {
  @Property()
  businessRegistrationNumber!: string;
}
```

---

## 5. [Interview Master] 정규화는 언제 멈춰야 하는가?

면접관이 묻습니다. **"무조건 3NF까지 지켜야 합니까?"**
전수자의 답변은 이렇습니다:
**"논리 모델링 단계에서는 가차 없이 3NF까지 밀어붙여야 합니다. 하지만 물리 모델링 단계에서는 조인 성능과 I/O 비용을 계산하여 전략적으로 반정규화(Denormalization)를 수행합니다. 즉, 이상 현상의 위험보다 조회 지연의 고통이 크다고 데이터(Statistics)로 입증되는 순간이 정규화가 멈추는 지점입니다."**

- "논리는 무결성, 물리는 성능" (Logic vs Physics)
답변에서 "논리는 3NF까지 밀어붙인다"는 부분이 아주 좋습니다. 그 이유는 처음부터 반정규화된 상태로 설계하면 데이터 간의 진짜 관계(Relationship)를 놓치기 때문입니다.

보강 한마디: "먼저 데이터의 정답지(3NF)를 만든 후, 성능이라는 '비즈니스 요구사항'에 맞춰 의도적으로 정답을 깨뜨리는 것이 올바른 순서입니다."

- 반정규화의 '트레이드오프' 명시
정규화를 멈추는(반정규화하는) 순간, 우리는 조회 성능을 얻는 대신 데이터 정합성 유지 비용을 지불하게 됩니다.

실무 팁: "반정규화를 할 때는 중복된 데이터를 업데이트할 때 발생하는 '애플리케이션 계층의 복잡도'와 '데이터 불일치 위험'을 감수할 가치가 있는지 반드시 계산해야 합니다."

- 구체적인 'Statistics(통계)'의 예시
"데이터로 입증되는 순간"이라는 표현이 매우 전문적입니다. 면접에서 구체적으로 어떤 데이터를 보냐고 묻는다면 아래와 같이 답하세요.

  - **조회 빈도**: 특정 조인 쿼리가 전체 트래픽의 80%를 차지하는가?
    - APM 활용: Datadog, New Relic, 혹은 Pinpoint 같은 도구에서 가장 많이 호출되는 API 리스트를 뽑습니다. 특정 API가 전체 트래픽의 상당수를 차지하고 그 내부에서 조인 쿼리가 발생한다면 1순위 후보입니다.
    - DB Slow Query Log: MySQL의 경우 long_query_time 을 설정해 느린 쿼리를 수집하거나, Performance Schema 를 조회해 어떤 쿼리가 가장 많이 실행되었는지(COUNT_STAR) 확인합니다.

  - **응답 시간(Latency)**: 조인으로 인해 인덱스 스캔 범위가 넓어져 SLO(Service Level Objective)를 초과하는가?
    - **EXPLAIN 실행**: 쿼리 앞에 EXPLAIN을 붙여 실행 계획을 봅니다.
      - type이 ALL(Full Table Scan)이거나 index인데 rows 숫자가 너무 큰 경우.
      - Extra 컬럼에 Using temporary나 Using filesort가 뜨면서 조인 순서가 꼬인 경우
    - **SLO 체크**: 서비스 목표가 "메인 피드 조회 100ms 이내"인데, 조인 때문에 300ms가 나온다면 물리적 구조 개선이 필요합니다.

  - **데이터 변경률**: 이 필드는 한번 쓰면 거의 안 바뀌는가? (자주 바뀐다면 반정규화 시 정합성 맞추기 지옥이 시작됩니다.)
    - **Update 횟수 측정**: 해당 필드가 수정되는 빈도를 측정합니다.
      - 예: **'사용자 이름'**은 거의 안 바뀝니다. (반정규화 OK)
      - 예: **'현재 재고량'**은 초당 수십 번 바뀝니다. (반정규화 금지! 정합성 깨지면 큰일 납니다.)
    - **Source of Truth 정의**: 데이터를 중복 저장하더라도, "어느 테이블이 진짜(Original)인가"를 명확히 해야 합니다. 원본이 바뀔 때 복사본들을 업데이트하는 이벤트 리스너(NestJS의 경우 EventEmitter나 Kafka 등) 로직을 설계해야 합니다.

---

## 6. 논리적 모델링 산출물 체크리스트

설계를 완성한 후 다음을 만족하는지 스스로 검수하십시오.

1. **모든 테이블에 기본키(PK)가 존재하는가?** (PK 없는 테이블은 힙(Heap) 테이블이 되어 성능의 불확실성을 가짐)
2. **데이터 도메인(Domain)을 정의했는가?** (예: `Age`는 `TINYINT UNSIGNED`, `Status`는 `ENUM` 등)
3. **외래키(FK)의 옵셔널리티를 확정했는가?** (부모 없는 자식이 가능할까? `NULL` 여부 결정)
4. **M:N 관계가 모두 교차 테이블로 해소되었는가?**

---

## 요약 가이드

| 정규형 | 핵심 해결 대상 | 비유 |
| :--- | :--- | :--- |
| **1NF** | 다중 값 속성 | 한 칸엔 한 명만 타세요 |
| **2NF** | 부분 종속성 | 네 정체성은 오직 주인님 전체에게 달려있어 |
| **3NF** | 이행 종속성 | 건너뛰고 아는 척하지 마세요 |
| **BCNF** | 결정자 종속성 | 결정권자는 곧 왕이어야 합니다 |

다음 아티클에서는 이렇게 정밀하게 설계된 논리 구조를 어떻게 물리적 디스크와 메모리 최적화 환경에 안착시킬지, **물리적 모델링: 인덱스 전략과 데이터 배치**를 전수하겠습니다.
