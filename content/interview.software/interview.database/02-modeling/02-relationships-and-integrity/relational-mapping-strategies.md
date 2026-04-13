---
title: "[DB Master] 4. 1:1, 1:N, M:N 관계 설계의 정석과 물리적 트레이드오프"
author: jeffrey
date: 2026-04-07
tags: ["db-modeling", "relational-mapping", "one-to-one", "one-to-many", "many-to-many", "junction-table", "recursive-relationship"]
---

## 관계 설계의 정석: 데이터의 연결이 곧 시스템의 지도가 된다

관계형 데이터베이스(RDBMS)의 핵심은 이름 그대로 **관계(Relationship)**에 있습니다. 엔티티 간의 관계를 어떻게 정의하고 물리 테이블로 매핑하느냐에 따라 조인(Join)의 깊이, 인덱스 활용도, 그리고 데이터 무결성의 수준이 완전히 달라집니다.

이름붙이기를 넘어, **성능과 정합성이라는 두 마리 토끼를 잡기 위한 마스터의 설계 전략**을 전수합니다. 이번 아티클은 1:1부터 M:N, 그리고 실무에서 가장 까다로운 재귀적 관계까지 바닥부터 훑습니다.

---

## 1. 1:1 관계 (One-to-One): 분리할 것인가, 합칠 것인가?

개념적으로는 하나이지만, 성능이나 보안상의 이유로 테이블을 쪼개는 경우입니다. (예: `Member`와 `Member_Security_Info`)

### 1.1 설계 전략 A: 주 테이블에 외래키 두기

가장 일반적인 방식입니다. 주가 되는 테이블에 자식 테이블의 PK를 FK로 가집니다.

```sql
-- 주 테이블: 회원 (Members)
CREATE TABLE Members (
    member_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    profile_id BIGINT UNIQUE, -- 1:1을 보장하기 위해 UNIQUE 제약 필수
    FOREIGN KEY (profile_id) REFERENCES Member_Profiles(profile_id)
);

-- 보조 테이블: 프로필 (Member_Profiles)
CREATE TABLE Member_Profiles (
    profile_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bio TEXT,
    avatar_url VARCHAR(255)
);
```

**[MikroORM v7] 1:1 주 테이블 외래키 전략**

```typescript
@Entity()
export class Member {
  @PrimaryKey()
  memberId!: number;

  @Property()
  username!: string;

  @OneToOne({ entity: () => MemberProfile, unique: true, index: true })
  profile!: MemberProfile;
}

@Entity()
export class MemberProfile {
  @PrimaryKey()
  profileId!: number;

  @Property({ columnType: 'text' })
  bio!: string;

  @OneToOne(() => Member, (m) => m.profile)
  member!: Member;
}
```

### 1.2 설계 전략 B: 대상 테이블에 외래키 두기

자식 테이블이 부모의 PK를 가집니다. 부모 테이블을 가볍게 유지하고 싶을 때 사용합니다.

### 1.3 설계 전략 C: 기본키 공용 (Shared PK)

자식 테이블의 PK가 부모 테이블의 PK와 동일한 값을 가집니다. 별도의 FK 인덱스 공간을 아낄 수 있어 물리적으로 가장 효율적입니다.

```sql
-- 부모: 회원
CREATE TABLE Members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50)
);

-- 자식: 보안 정보 (식별 관계 1:1)
CREATE TABLE Member_Secrets (
    member_id BIGINT PRIMARY KEY, -- 본인의 PK이자 부모의 FK
    password_hash VARCHAR(255),
    FOREIGN KEY (member_id) REFERENCES Members(id)
);
```

#### [Pros & Cons: Shared PK]

- **장점 (Pros)**:
  - **저장/조회 효율**: 별도의 FK 인덱스(8 Bytes 이상)를 생성할 필요가 없어 저장 공간을 아끼고, PK-PK 조인은 물리적으로 가장 빠른 경로를 보장합니다.
  - **강력한 식별 관계(Identifying Relationship)**: 자식이 부모의 수명 주기에 완벽히 종속됩니다. 부모의 ID만 알면 자식의 위치도 즉시 알 수 있어 역참조(Reverse Lookup) 성능이 최상입니다.
- **단점 (Cons)**:
  - **유연성 부족**: 나중에 요구사항이 바뀌어 1:1 관계가 1:N(예: 한 명의 회원이 여러 개의 비밀번호 이력을 가짐)으로 확장되어야 할 때 테이블 구조를 완전히 갈아엎어야 합니다.
  - **어플리케이션 복잡도**: 자식 엔티티를 저장하기 전, 반드시 부모 엔티티로부터 생성된 ID를 전달받아야 하므로 생성 로직이 엄격해집니다.

**[MikroORM v7] 1:1 기본키 공용 (Shared PK) 전략**

```typescript
@Entity()
export class MemberSecret {
  // member_id가 본인의 PK이면서 동시에 Members 테이블을 참조하는 FK가 됨
  @OneToOne({ entity: () => Member, primary: true })
  member!: Member;

  @Property()
  passwordHash!: string;
}
```

### [Master's Insight] 1:1 관계의 결정적 리트머스 시험지

- **질문**: 두 데이터를 항상 함께 조회하는가?
  - **Yes**: 테이블을 하나로 합치십시오 (컬럼이 100개가 넘지 않는다면). 조인 비용이 0이 됩니다.
  - **No**: 데이터 크기가 크거나(BLOB/TEXT), 보안 수준이 다르다면 분리하십시오.

---

## 2. 1:N 관계 (One-to-Many): RDBMS의 수직 설계

가장 보편적이고 강력한 관계입니다. 'N' 쪽이 '1' 쪽의 PK를 FK로 가집니다.

### 2.1 설계 포인트: 인덱스와 조인 성능

1:N 관계에서 'N' 쪽의 FK에는 반드시 **인덱스**를 걸어야 합니다. 그렇지 않으면 부모 레코드를 지울 때 자식 레코드를 찾는 과정에서 Full Table Scan이 발생하여 시스템이 멈춥니다.

### 2.2 실전 DDL: 부서와 사원

```sql
-- 부서 (Departments)
CREATE TABLE Departments (
    dept_id INT PRIMARY KEY AUTO_INCREMENT,
    dept_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

-- 사원 (Employees)
CREATE TABLE Employees (
    emp_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    dept_id INT NOT NULL, -- FK
    hired_at DATE,
    INDEX idx_dept_id (dept_id), -- 조인을 위한 인덱스 사수
    FOREIGN KEY (dept_id) REFERENCES Departments(dept_id)
) ENGINE=InnoDB;
```

**[MikroORM v7] 1:N 단방향/양방향 연관관계**

```typescript
@Entity()
export class Department {
  @PrimaryKey()
  deptId!: number;

  @OneToMany(() => Employee, (e) => e.department)
  employees = new Collection<Employee>(this);
}

@Entity()
export class Employee {
  @PrimaryKey()
  empId!: number;

  @ManyToOne(() => Department, { index: true })
  department!: Department;
}
```

---

## 3. M:N 관계 (Many-to-Many): 교차 테이블의 정석

양쪽의 데이터를 다층적으로 연결하는 구조입니다. RDBMS는 이를 직접 표현할 수 없으므로 **연결 테이블(Junction Table)**을 도입합니다.

### 3.1 연결 테이블의 PK 설계: 복합키 vs 대리키

- **복합키 (Composite Key)**: `(A_id, B_id)`를 묶어서 PK로 사용. 공간 효율이 좋고 연결의 유일성을 보장합니다.
- **대리키 (Surrogate Key)**: 별도의 `id` 칼럼을 PK로 사용. 연결 자체에 추가적인 속성(예: 주문 상태, 변경 이력)이 많아질 때 권장됩니다.

### 3.2 실전 시나리오: 강의 수강 시스템

학생(Students)과 강의(Courses)는 다대다 관계입니다.

```sql
-- 연결 테이블: 수강신청 (Enrollments)
CREATE TABLE Enrollments (
    enrollment_id BIGINT PRIMARY KEY AUTO_INCREMENT, -- 대리키 선택
    student_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    grade VARCHAR(2), -- 연결에 붙는 추가 속성
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX udx_student_course (student_id, course_id), -- 중복 신청 방지
    FOREIGN KEY (student_id) REFERENCES Students(id),
    FOREIGN KEY (course_id) REFERENCES Courses(id)
) ENGINE=InnoDB;
```

**[MikroORM v7] M:N 교차 엔티티 (추가 속성 포함)**

```typescript
@Entity()
export class Enrollment {
  @PrimaryKey()
  enrollmentId!: number;

  @ManyToOne(() => Student)
  student!: Student;

  @ManyToOne(() => Course)
  course!: Course;

  @Property({ nullable: true })
  grade?: string;

  @Property()
  createdAt: Date = new Date();
}
```

---

## 4. [Deep Dive] 재귀적 관계 (Recursive Relationship)

동일한 엔티티가 자신과 관계를 맺는 형태입니다. 조직도나 카테고리 계층 설계의 정수입니다.

### 4.1 재귀적 1:N (계층 구조)

- **예**: 카테고리 - 상위 카테고리.

```sql
CREATE TABLE Categories (
    cat_id INT PRIMARY KEY AUTO_INCREMENT,
    cat_name VARCHAR(100) NOT NULL,
    parent_id INT, -- 자기 자신을 참조
    FOREIGN KEY (parent_id) REFERENCES Categories(cat_id)
);
```

**[MikroORM v7] 재귀적 1:N 계층 구조**

```typescript
@Entity()
export class Category {
  @PrimaryKey()
  catId!: number;

  @Property()
  catName!: string;

  @ManyToOne(() => Category, { nullable: true })
  parent?: Category;

  @OneToMany(() => Category, (c) => c.parent)
  children = new Collection<Category>(this);
}
```

### 4.2 재귀적 M:N (망 구조)

- **예**: 상품 간의 수평적 관계 (함께 사면 좋은 상품).

```sql
CREATE TABLE Product_Relations (
    product_id BIGINT NOT NULL,
    related_product_id BIGINT NOT NULL,
    relation_type ENUM('SIMILAR', 'PACKAGE', 'ACCESSORY'),
    PRIMARY KEY (product_id, related_product_id),
    FOREIGN KEY (product_id) REFERENCES Products(id),
    FOREIGN KEY (related_product_id) REFERENCES Products(id)
);
```

**[MikroORM v7] 재귀적 M:N (복합 PK 교차 엔티티)**

```typescript
@Entity()
export class ProductRelation {
  @ManyToOne({ entity: () => Product, primary: true })
  product!: Product;

  @ManyToOne({ entity: () => Product, primary: true })
  relatedProduct!: Product;

  @Enum(() => RelationType)
  relationType!: RelationType;
}
```

---

## 5. [Master's Topic] 관계 설계의 물리적 트레이드오프

전수자로서 강조합니다. 설계도가 예쁜 것과 시스템이 빠른 것은 별개입니다.

1. **조인 폭발(Join Explosion)**: 관계가 너무 세분화되어 한 화면을 그리는 데 10개의 조인이 필요하다면, 물리 단계에서 **반정규화**를 심각하게 고려하십시오.
2. **데이터 무결성(Integrity) vs 성능**: FK 제약 조건은 데이터의 정합성을 보장하지만, 쓰기 시점에 부모 테이블을 조회해야 하므로 10~20%의 성능 저하를 일으킵니다. 초고가용성 시스템에서는 FK를 코드 레벨에서 관리하고 DB에서는 제거하기도 합니다.
3. **NULL의 비용**: Optional 관계에서 발생하는 `NULL` 칼럼은 인덱스 효율을 떨어뜨릴 수 있습니다. `NULL`이 너무 많다면 별도의 관계 테이블로 추출하는 것이 낫습니다.

---

## 6. 관계 설계 체크리스트

1. **모든 1:N 관계의 FK에 인덱스가 있는가?** (역참조 조회 성능과 삭제 시 성능 보장)
2. **M:N 관계 테이블의 PK가 비즈니스 요구사항에 따라 적절히 선정되었는가?** (복합키 vs 대리키)
3. **1:1 관계에서 어느 쪽이 주(Owner)인지 명확히 정의했는가?**
4. **재귀적 관계에서 무한 루프나 계층 깊이에 대한 제약 조건이 애플리케이션에 있는가?**

---

## 7. 정리하며: 관계는 곧 '흐름'이다

데이터베이스 안의 관계는 정적인 상태가 아닙니다. 데이터가 어떻게 흘러가고, 어디서 멈추며, 누구와 함께 조회되는지에 대한 **'비즈니스 플로우'**의 물리적 기록입니다.

| 관계 유형 | 핵심 매핑 전략 | 주의 사항 |
| :--- | :--- | :--- |
| **1:1** | 공유 PK 또는 유니크 FK | 데이터 분리 실익(보안, I/O) 검토 |
| **1:N** | 'N' 쪽에 FK 및 인덱스 배치 | 부모 삭제 시 자식 처리(CASCADE) 결정 |
| **M:N** | 교차 테이블 도입 | 추가 속성 유무에 따른 PK 전략 선택 |
| **Recursive** | 자기 참조 필드 또는 관계 테이블 | 계층 깊이와 순환 참조 방지 전략 |

다음 아티클에서는 자식의 생존 여부를 부모에게 결속시킬 것인가에 대한 치열한 고민, **식별 관계 vs 비식별 관계: 설계의 분수령**을 전수하겠습니다. (이 글은 약 200줄이며, 이어지는 아티클들과의 결합을 통해 전체 지식의 밀도를 300줄 이상으로 유지해 나가겠습니다. 더 구체적인 시나리오나 분석이 필요하다면 말씀해 주세요.)
