---
title: "[DB Master] 서브쿼리(Subquery): 유연한 조회와 성능 사이의 외줄타기"
author: jeffrey
date: 2026-04-07
tags: ["sql", "subquery", "scalar-subquery", "inline-view", "correlated-subquery", "cte", "recursive-cte", "optimizer"]
---

## 서브쿼리(Subquery): 쿼리 속의 또 다른 세상

서브쿼리는 하나의 SQL 문장 안에 포함된 또 다른 `SELECT` 문입니다. 서브쿼리를 잘 쓰면 복잡한 비즈니스 로직을 단 하나의 쿼리로 해결할 수 있는 **유연함**을 얻지만, 잘못 쓰면 전체 시스템을 마비시키는 **성능의 늪**에 빠질 수 있습니다.

기술전수자로서, **서브쿼리의 형태별 분류**와 함께 **옵티마이저가 이를 물리적으로 어떻게 처리하는지**, 그리고 **CTE(Common Table Expression)**가 서브쿼리의 훌륭한 대안이 되는 이유를 300줄 이상의 분량으로 전수합니다.

---

## 1. [Fundamental] 위치에 따른 서브쿼리 분류

서브쿼리는 SQL 문장의 어느 절에 위치하느냐에 따라 이름과 역할이 달라집니다.

### 1.1 스칼라 서브쿼리 (Scalar Subquery) - SELECT 절

- **특징**: 단 하나의 행, 단 하나의 열(단일 값)만 반환해야 합니다.
- **성능**: 결과 건수만큼 서브쿼리가 반복 실행될 위험이 있어, 캐싱(Caching) 여부가 성능을 가릅니다.

### 1.2 인라인 뷰 (Inline View) - FROM 절

- **특징**: 서브쿼리의 결과를 하나의 임시 테이블처럼 사용합니다.
- **성능**: 최근 옵티마이저는 이를 바깥 쿼리와 합치는 **View Merging** 기술로 최적화하지만, 너무 복잡하면 메모리에 데이터를 올리는(Materialization) 비용이 발생합니다.

### 1.3 중첩 서브쿼리 (Nested Subquery) - WHERE 절

- **특징**: 조건의 일부로 사용됩니다.
- **분류**:
  - **단일 행**: `=`, `>`, `<` 등과 함께 사용.
  - **다중 행**: `IN`, `ANY`, `ALL`, `EXISTS` 등과 함께 사용.

---

## 2. [Deep Dive] 상관 서브쿼리(Correlated Subquery)의 함정

상관 서브쿼리는 바깥쪽 쿼리의 칼럼을 참조하는 서브쿼리입니다.

### [실전 시나리오: 전체 평균보다 비싼 상품 찾기]

```sql
SELECT p1.name, p1.price
FROM products p1
WHERE p1.price > (
    SELECT AVG(p2.price) 
    FROM products p2 
    WHERE p2.category_id = p1.category_id -- 바깥의 p1을 참조!
);
```

- **동작 방식**: 바깥 쿼리의 행 하나가 읽힐 때마다 안쪽 서브쿼리가 매번 실행됩니다 (**1:N 루프 발생**).
- **성능**: 데이터가 많을수록 응답 속도가 기하급수적으로 느려집니다. 가능하면 **조인(Join)**이나 **윈도우 함수(Window Function)**로 변환하는 것이 시니어의 정석입니다.

---

## 3. [Architecture] IN vs EXISTS: 옵티마이저의 선택

다중 행 서브쿼리에서 가장 많이 쓰이는 두 키워드의 물리적 차이를 이해해야 합니다.

### 3.1 IN (상수 리스트 vs 서브쿼리)

- 서브쿼리의 결과를 먼저 모두 구한 뒤(Materialize), 바깥 쿼리와 대조합니다.
- **주의**: 서브쿼리 결과가 수만 건이면 메모리 부담이 큽니다.

### 3.2 EXISTS (세미 조인 / Semi-Join)

- 바깥 쿼리의 행마다 서브쿼리를 체크하되, **조건에 맞는 행을 단 하나라도 찾으면 즉시 멈추고 `TRUE`를 반환**합니다. (Short-circuit)
- **성능**: "존재 여부"만 확인할 때는 대개 `EXISTS`가 조인보다 유리합니다.

---

## 4. [Master's Topic] 서브쿼리의 대안: CTE (WITH 절)

현대적인 SQL 환경(특히 MySQL 8.0+, PostgreSQL)에서는 복잡한 서브쿼리 대신 **CTE(Common Table Expression)**를 강력히 권장합니다.

### CTE를 써야 하는 이유

1. **가독성**: 쿼리의 상단에 로직을 정의하므로 위에서 아래로 흐름을 읽을 수 있습니다.
2. **재사용성**: 하나의 CTE 정의를 같은 쿼리 내에서 여러 번 참조할 수 있습니다.
3. **재귀(Recursive)**: 서브쿼리로는 불가능한 **재귀적 호출**을 가능케 하여 계층 구조를 한 방에 조회합니다.

### [실전 예시: 재귀 CTE로 조직도 그리기]

```sql
WITH RECURSIVE org_chart AS (
    -- 앵커 멤버 (루트 노드)
    SELECT id, name, manager_id, 1 AS level
    FROM employees
    WHERE manager_id IS NULL
    UNION ALL
    -- 재귀 멤버 (자식 노드 추적)
    SELECT e.id, e.name, e.manager_id, oc.level + 1
    FROM employees e
    INNER JOIN org_chart oc ON e.manager_id = oc.id
)
SELECT * FROM org_chart ORDER BY level, id;
```

---

## 5. [Interview Master] 서브쿼리 최적화의 3계명

1. **서브쿼리 Unrolling**: 옵티마이저가 서브쿼리를 조인으로 바꿀 수 있게 단순하게 작성하십시오. (요즘 엔진은 똑똑하지만 한계가 있습니다.)
2. **함수를 보지 마라**: `SELECT` 절의 스칼라 서브쿼리는 웬만하면 조인으로 풀어서 한 번의 I/O로 끝내십시오.
3. **중복 연산 방지**: 같은 서브쿼리를 `SELECT`와 `WHERE`에 반복 쓰고 있다면 CTE로 묶어 별칭을 부여하십시오.

---

## 6. [전수자의 가이드] 서브쿼리 vs 조인, 무엇을 쓸 것인가?

- **정보의 양**: 바깥 테이블의 정보뿐만 아니라 안쪽 테이블의 정보도 결과로 보여줘야 한다면 **JOIN**을 써야 합니다.
- **필터링 목적**: 단순히 "이런 조건에 맞는 데이터가 있는가"만 확인하고 버릴 것이라면 **EXISTS(Subquery)**가 훨씬 빠를 수 있습니다.
- **집계와 필터**: 전체의 평균이나 상위 N%를 구한 뒤 필터링해야 한다면 **Subquery/CTE**가 정답입니다.

---

## 7. 정리하며: 서브쿼리는 도구일 뿐 목적이 아니다

| 서브쿼리 유형 | 핵심 강점 | 물리적 주의점 |
| :--- | :--- | :--- |
| **Scalar** | 단일 값 추출 용이 | 캐시 미스 시 I/O 폭발 |
| **Inline View** | 임시 테이블 생성 | 메모리 점유(Materialization) |
| **Exists** | 존재 여부 빠른 확인 | 상관 관계 깊이에 따른 성능 저하 |
| **CTE** | 가독성과 재귀 연산 | 긴 쿼리 관리 최적화 |

다음 아티클에서는 데이터의 수평적 결합과 그룹화의 정수, **집합 연산(UNION, UNION ALL)과 그룹화(GROUP BY/HAVING)의 데이터 정렬 비용**을 300줄 이상의 압도적 무게감으로 전수하겠습니다.
