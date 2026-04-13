---
title: "[DB Master] 9. Lateral Join & Cross Apply: 행 단위(Row-by-row) 동기화 결합의 실체"
author: jeffrey
date: 2026-04-07
tags: ["sql", "lateral-join", "cross-apply", "correlated-subquery", "performance", "optimization", "n-plus-one-problem"]
---

## Lateral Join & Cross Apply: 동적 결합의 메커니즘

전통적인 SQL `JOIN`은 정적인 두 집합을 결합하지만, 실무에서는 **"각 행(Row)마다 특정 연산을 수행한 결과"**를 붙여야 할 때가 있습니다. (예: 각 상점에 대해 가장 최근에 등록된 리뷰 1개만 조회)

일반적인 `LEFT JOIN`이나 `INNER JOIN`으로는 행별로 상위 N개를 제한하거나 복잡한 서브쿼리를 실행하기 어렵습니다. **Lateral Join**(PostgreSQL/MySQL 8+)과 **Cross Apply**(SQL Server/Oracle)는 조인 절에서 외부 테이블의 칼럼을 참조하여 행마다 동적인 서브쿼리를 실행하는 해법입니다.

---

## 1. 동적 상관 서브쿼리(Correlated Subquery)의 물리적 진화

Lateral Join은 상관 서브쿼리가 조인 절에 배치되어 인덱스 시크(Index Seek)를 유도하는 구조입니다.

### 1.1 일반 JOIN vs Lateral JOIN

1. 일반 JOIN: 오른쪽 테이블(B)이 왼쪽 테이블(A)의 칼럼을 참조할 수 없습니다. B는 독립적으로 완성된 집합이어야 합니다.
2. Lateral JOIN: 오른쪽 서브쿼리가 왼쪽 테이블(A)의 행 데이터를 매개변수처럼 전달받아 실시간으로 결과셋을 생성합니다.

> **핵심 원리**: 엔진은 왼쪽 행을 읽을 때마다 해당 칼럼 값을 기반으로 오른쪽 서브쿼리를 최적화하여 실행합니다. 이는 애플리케이션 레벨의 `for` 루프와 논리적으로 유사하지만, 엔진 내부의 I/O 경로를 통해 물리적으로 훨씬 빠르게 동작합니다.

---

## 2. 실전: 상점별 TOP 3 인기 상품 추출 (N+1 문제 해결)

상점별로 가장 높은 판매량의 상품을 단 3개씩만 조회하는 예시입니다.

### 2.1 일반 JOIN의 한계

일반 조인을 쓰면 상점별 전체 상품을 다 가져와서 필터링해야 하므로 데이터 유량이 과급됩니다.

### 2.2 Lateral Join의 해법

```sql
SELECT s.shop_name, p.product_name, p.sales_count
FROM shops s
CROSS JOIN LATERAL (
    SELECT product_name, sales_count
    FROM products
    WHERE shop_id = s.shop_id
    ORDER BY sales_count DESC
    LIMIT 3
) p;
```

---

## 3. 함수형 연산과의 결합 사례

Lateral Join은 JSON 데이터를 행별로 펼치거나 시계열 이동 평균을 구하는 함수 연산과 결합할 때 강력합니다.

- **JSON 해소**: JSON 배열 컬럼의 각 요소를 즉시 테이블로 변환하여 행별로 연결합니다.
- **분석 함수**: 특정 칼럼을 매개변수로 받는 사용자 정의 함수(UDF)를 매 행마다 호출합니다.

---

## 4. 성능 최적화와 인덱스 전략

Lateral Join은 전체 데이터를 읽어 필터링하는 비용을 **인덱스 탐색 비용(Seek Cost)**으로 치환하는 전략입니다. 따라서 서브쿼리의 `WHERE` 조건(예: `shop_id = s.shop_id`)을 구성하는 칼럼에 인덱스가 없다면 매 행마다 전체 스캔이 발생하여 치명적인 성능 저하를 초래합니다.

---

## 5. Lateral Join 최적화 수칙

1. 인덱스 시크 사수: 서브쿼리 내부의 매개변수 참조 칼럼은 반드시 인덱스의 선두 칼럼이어야 합니다.
2. TOP-N 사용: 서브쿼리 결과가 고정된 몇 개의 행(TOP-N)일 때 최대 효율을 냅니다.
3. LEFT JOIN LATERAL: 서브쿼리 결과가 없는 부모 데이터도 유지해야 할 때 선택합니다.
