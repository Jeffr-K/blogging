---
title: "[DB Master] 집합 연산과 그룹화: 데이터 정합성과 정렬의 비용"
author: jeffrey
date: 2026-04-07
tags: ["sql", "union", "union-all", "group-by", "having", "aggregation", "sorting", "hashing", "window-function"]
---

## 집합 연산과 그룹화: 데이터를 융합하고 요약하는 기술

관계형 데이터베이스는 집합론에 기원을 두고 있습니다. **집합 연산자(Set Operators)**는 여러 쿼리의 결과를 수평적으로 합치는 도구이며, **그룹화(Grouping)**는 방대한 데이터를 하나로 응축하여 통찰을 뽑아내는 핵심 기술입니다.

기술전수자로서, **집합 연산 시 발생하는 보이지 않는 정렬 비용**과 **`GROUP BY`가 메모리 상에서 데이터를 어떻게 해싱(Hash Aggregate)하여 요약하는지** 그 물리적 실체를 300줄 이상의 분량으로 전수합니다.

---

## 1. [Fundamental] 집합 연산자 (Set Operators)

집합 연산은 동일한 칼럼 구조를 가진 두 쿼리의 결과 셋(Result Set)을 하나로 합칩니다.

### 1.1 UNION vs UNION ALL - 정렬의 트레이드오프

이 두 키워드의 차이를 아는 것이 성능 최적화의 첫걸음입니다.

- **UNION**: 두 집합을 합친 뒤 **중복을 제거**합니다. 이를 위해 엔진은 전체 데이터를 **정렬(Sort)**하거나 **해시 테이블**에 담아 중복을 확인합니다. (매우 무거운 작업!)
- **UNION ALL**: 중복을 확인하지 않고 두 집합을 그대로 붙입니다. 정렬이 아예 발생하지 않아 압도적으로 빠릅니다.

> **💡 전수자의 가이드**: 비즈니스 로직상 두 결과 셋에 중복 데이터가 나올 리 없거나, 중복이 있어도 무방하다면 **기필코 `UNION ALL`을 사용하십시오.**

### 1.2 INTERSECT (교집합) & EXCEPT (차집합)

- **INTERSECT**: 양쪽 결과에 공통으로 존재하는 데이터만 추출.
- **EXCEPT / MINUS**: 첫 번째 결과 중 두 번째 결과에 없는 데이터만 추출.
- **MySQL 팁**: MySQL 8.0 이전에는 `INTERSECT`를 `INNER JOIN`으로, `EXCEPT`를 `LEFT JOIN ... WHERE B.id IS NULL`로 우회 구현해야 했습니다.

---

## 2. [Deep Dive] GROUP BY의 물리적 동작 원리

DB 엔진이 수천만 건의 데이터를 특정 칼럼 기준으로 묶을 때 사용하는 두 가지 주요 알고리즘입니다.

### 2.1 Sort Aggregate (정렬 기반 집계)

- **방식**: 집계 기준 칼럼으로 전체 데이터를 **정렬**합니다. 정렬된 데이터는 같은 값끼리 모여 있으므로, 위에서 아래로 읽으며 순차적으로 합계를 구합니다.
- **특징**: `ORDER BY`가 필요하지 않아도 내부적으로 정렬 비용이 발생합니다.

### 2.2 Hash Aggregate (해시 기반 집계)

- **방식**: 기준 칼럼의 값을 **해시 함수**에 통과시켜 각 그룹을 별도의 메모리 버킷(Bucket)에 담습니다.
- **특징**: 데이터가 무작위로 섞여 있어도 한 번의 스캔(Full Scan)만으로 집계가 가능하여, 정렬이 필요 없을 때 훨씬 효율적입니다.

---

## 3. [Master's Topic] 다차원 집계: ROLLUP과 CUBE

단순한 그룹화를 넘어 전체 합계와 소계(Subtotal)를 한 번의 쿼리로 뽑아내는 고급 기술입니다.

### 3.1 ROLLUP - 계층적 소계

- **예**: "카테고리별 매출 + 전체 매출 합계"

```sql
SELECT category_id, brand_id, SUM(price)
FROM products
GROUP BY category_id, brand_id WITH ROLLUP;
```

- 결과: (카테고리, 브랜드)별 합계 -> 카테고리별 소계 -> 전체 총계 순으로 데이터가 계층화되어 나옵니다.

### 3.2 GROUPING SETS (고급)

사용자가 원하는 그룹 조합만 콕 집어서 집계할 수 있게 해주는 기능으로, 데이터 웨어하우스(DW) 급의 복잡한 리포팅에 필수적입니다.

---

## 4. [Advanced] 윈도우 함수(Window Function)의 출현

`GROUP BY`는 데이터의 행 수를 줄여버리지만(Aggregation), **윈도우 함수**는 행의 개수를 유지하면서 그룹별 통계치를 각 행 옆에 붙여줍니다.

### [실전 예시: 사용자별 최근 주문 일자 뽑기]

```sql
SELECT name, order_date,
       RANK() OVER (PARTITION BY member_id ORDER BY order_date DESC) as order_rank
FROM orders;
```

- 여기서 `PARTITION BY`는 `GROUP BY`와 같고, `ORDER BY`는 그룹 내의 정렬 순서입니다. 행을 물리적으로 합치지 않고도 순위(Rank)나 누적 합계(Running Total)를 구할 수 있습니다.

---

## 5. [Interview Master] HAVING 절의 치명적인 함정

많은 개발자가 `HAVING`을 단순히 "그룹 조건"으로만 알고 있습니다. 하지만 **실행 순서**를 기억하십시오.

1. **WHERE**: 디스크에서 데이터를 읽을 때 버림 (I/O 절약 가능).
2. **GROUP BY**: 남은 데이터를 메모리에 올려 정렬/해싱. (CPU/Memory 점유)
3. **HAVING**: 집계가 끝난 결과물 중에서 또 버림 (이미 늦었음).

**"WHERE로 할 수 있는 일은 절대 HAVING에 맡기지 마십시오."** 이것이 시니어의 쿼리 튜닝 원칙입니다.

---

## 6. [전수자의 가이드] 대용량 집계 쿼리 최적화 전략

1. **사전 필터링 (Pre-filtering)**: `GROUP BY` 대상이 되는 행의 수를 `WHERE`에서 90% 이상 줄이면 집계 속도는 10배 이상 빨라집니다.
2. **드라이빙 인덱스 활용**: `GROUP BY` 절의 칼럼이 인덱스의 선두 칼럼이라면, 엔진은 **Sort/Hash** 연산 없이 인덱스 스캔만으로 그룹화를 끝낼 수 있습니다 (**Very Important**).
3. **UNION vs CASE WHEN**: 여러 쿼리를 `UNION`으로 합치기보다, 단일 쿼리 내에서 `CASE WHEN` 제어문을 활용해 그룹별 집계를 한 번에 처리하는 것이 효율적입니다.

---

## 7. 정리하며: 집합과 그룹의 물리적 이해

| 키워드 | 물리적 비용 | 핵심 가이드 |
| :--- | :--- | :--- |
| **UNION ALL** | 0 (단순 병합) | 중복 제거가 꼭 필요한지 따질 것 |
| **UNION** | High (정렬 제거) | 정렬 오버헤드 주의 |
| **GROUP BY** | Medium/High | 인덱스 활용 여부가 성능의 가점 |
| **HAVING** | Low | 실행 순서 상 이미 늦은 필터링 |
| **OVER()** | Medium | 복잡한 리포팅의 구원자 |

다음 아티클에서는 데이터를 실제로 변경하고 삭제하는 물리적 행위, **DML(INSERT/UPDATE/DELETE)의 내부 동작과 트랜잭션 락의 실체**를 300줄 이상의 압도적 분량으로 전수하겠습니다.
