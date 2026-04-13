---
title: "클러스터드 vs 세컨더리 인덱스: MySQL vs PostgreSQL"
author: jeffrey
date: 2026-04-13
tags: ["mysql", "postgresql", "clustered-index", "heap-table"]
---

## 클러스터드 vs 세컨더리 인덱스: MySQL vs PostgreSQL 구조 비교

데이터 모델링 단계에서 우리는 수많은 테이블을 설계합니다. 이때 각 테이블의 **Primary Key(PK)**를 무엇으로 정할지는 단순히 유니크한 값을 정하는 수준이 아니라, **데이터가 디스크에 물리적으로 어떻게 박힐지**를 결정하는 중차대한 작업입니다.

DBMS 엔진마다 이 데이터를 배치하는 철학이 다른데, 가장 대표적인 두 주자인 MySQL(InnoDB)과 PostgreSQL의 차이를 서술해 보겠습니다.

---

## 1. MySQL InnoDB: 클러스터드 인덱스 (Clustered Index)

InnoDB의 철학은 명확합니다. **"Primary Key가 곧 테이블 그 자체다"**라는 것입니다.

### InnoDB의 물리적 실체

MySQL에서 PK 인덱스를 생성하면, 실제 행(Row) 데이터 전체가 그 인덱스의 리프 노드에 저장됩니다. 즉, 데이터를 PK 순서대로 정렬하여 디스크에 차곡차곡 쌓아둡니다.

- **장점**: PK로 조회하면 추가적인 디스크 탐색 없이 바로 행 데이터를 얻을 수 있습니다. 조회 성능이 극대화됩니다.
- **단점**: PK가 아닌 다른 컬럼으로 만든 인덱스(세컨더리 인덱스)를 타고 데이터를 찾으면, 인덱스 안에서 PK 값을 먼저 찾은 뒤 다시 PK 인덱스로 넘어가서 데이터를 찾아야 하는 **두 번의 탐색(Double Lookup)**이 발생합니다.

### 모델링 고려 사항

- MySQL을 쓴다면 PK는 반드시 **순차적으로 증가하는 값(Auto-increment)**이 유리합니다. 만약 무작위 값(UUID 등)을 사용하면, 새로운 데이터를 넣을 때마다 중간에 공간을 만들기 위해 기존 데이터를 밀어내고 페이지를 쪼개는 **'페이지 피로(Page Split)'**가 발생하여 삽입 성능이 급격히 저하됩니다.

---

## 2. PostgreSQL: Heap 구조와 보조 인덱스

PostgreSQL의 철학은 조금 더 자유롭습니다. **"인덱스는 인덱스고, 데이터는 그냥 순서대로 저장하자"**입니다.

### PostgreSQL의 물리적 실체

PostgreSQL은 테이블 데이터를 저장할 때 특정 순서를 지키지 않고 들어오는 대로 비어있는 공간(Heap)에 쑤셔 넣습니다.

- **특징**: 모든 인덱스(PK 포함)는 가볍습니다. 리프 노드에는 데이터가 있는 **물리적 위치 주소(ctid)**만 들어 있습니다.
- **장점**: 데이터 삽입(INSERT) 시 정렬 부담이 적어 매우 빠릅니다. 또한 어떤 정렬 조건의 인덱스라도 데이터 주소만 가리키면 되므로 구조가 일관적입니다.
- **단점**: 인덱스를 통해 데이터를 찾더라도 실제 데이터를 보려면 반드시 Heap 영역을 다시 조회해야 하는 추가 I/O가 늘 발생합니다. (이를 보완하기 위해 PostgreSQL은 Index Only Scan이라는 기술을 적극 활용합니다.)

---

## 3. 모델링 실무 예제: MySQL vs PostgreSQL

동일한 주문 테이블을 설계할 때의 차이를 코드로 살펴보겠습니다.

### MySQL (InnoDB) 설계

```sql
CREATE TABLE orders (
    order_id BIGINT AUTO_INCREMENT PRIMARY KEY, -- 이 값이 물리적 정렬의 기준이 됨
    user_id INT,
    total_price DECIMAL(10, 2),
    INDEX idx_user (user_id) -- 이 인덱스는 (user_id + order_id) 정보를 가짐
) ENGINE=InnoDB;
```

- **성능 포인트**: `user_id`로 조회하면 `order_id`를 알아낸 뒤, 다시 PK 트리로 가서 `total_price`를 가져와야 합니다.

### PostgreSQL 설계

```sql
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY, -- 그냥 유니크 제약일 뿐, 물리 정렬과는 무관
    user_id INT,
    total_price DECIMAL(10, 2)
);
CREATE INDEX idx_user ON orders (user_id); -- 이 인덱스는 (user_id + ctid) 정보를 가짐
```

- **성능 포인트**: 어떤 인덱스를 타든 리프 노드에서 '주소'를 찾아 원본 데이터를 가져오는 일은 공평(?)하게 발생합니다.

---

## 4. 결론: 모델링 단계에서의 선택

1. **조회(SELECT)가 절대적으로 중요한 시스템**(예: 상품 조회 서비스)이고 MySQL을 쓴다면, 조회의 키가 되는 값을 PK로 두거나 커버링 인덱스를 촘촘히 설계해야 합니다.
2. **로그 성 데이터처럼 삽입(INSERT)이 빈번한 시스템**이라면 PostgreSQL의 Heap 구조가 더 안정적인 성능을 보여줄 수 있습니다.

인덱스의 이름만 보고 기능을 유추하는 것을 넘어, 내 데이터가 디스크 상에서 어떤 모양으로 정렬되어 있을지 상상하는 것. 그것이 모델링 단계에서 성능을 결정짓는 핵심적인 직관입니다.
