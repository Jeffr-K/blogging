---
title: "[DB Master] 8. Recursive CTE: 계층과 망(Graph)을 정복하는 SQL 재귀 탐색의 기술"
author: jeffrey
date: 2026-04-07
tags: ["sql", "recursive-cte", "with-recursive", "hierarchy", "tree-traversal", "bom", "optimization"]
---

## Recursive CTE: 선언적 언어로 구현하는 알고리즘적 탐색

관계형 데이터베이스(RDBMS)의 표 구조는 평면적이지만, 현실의 데이터는 **조직도**, **카테고리 트리**, **부품 구성도(BOM)** 등 입체적이고 깊은 계층을 가집니다. 일반적인 `JOIN`만으로는 깊이를 알 수 없는 계층을 탐색하는 데 한계가 있습니다.

**Recursive CTE(재귀적 공통 테이블 식별자)**는 SQL이 스스로의 결과셋을 다시 참조하며 깊이 우선 혹은 너비 우선으로 데이터를 파헤치는 도구입니다. 재귀 쿼리의 물리적 동작 원리와 실전 활용법을 분석합니다.

---

## 1. Recursive CTE의 작동 메커니즘

재귀 쿼리는 내부적으로 **Anchor Member**와 **Recursive Member**라는 두 개의 논리적 집합이 조인과 합집합(`UNION ALL`)을 통해 데이터를 확장해 나가는 과정입니다.

### 1.1 논리적 실행 3단계

1. Step 1 (Anchor Member Execution): 재귀의 시작점이 되는 쿼리를 실행하여 결과셋(Result Set)을 생성합니다. 이것이 0단계 데이터(Root)가 됩니다.
2. Step 2 (Recursive Step): 직전 단계에서 생성된 결과셋을 기반으로 자기 자신과 조인하여 다음 단계의 데이터를 찾습니다. 이때 새로 발견된 행들만 임시 테이블에 담습니다.
3. Step 3 (Fixed Point Check): 더 이상 새로운 행이 발견되지 않을 때까지 Step 2를 반복합니다.

> **핵심 분석**: 엔진은 매 루프마다 직전 단계에서 새로 발견된 행만 메모리에 올려 다음 조인을 수행합니다. 델타(Delta) 단위로 전진하기 때문에 효율적인 스택(Stack) 구조로 동작합니다.

---

## 2. 실전: 무한 계층 카테고리 경로(Path) 추출

사용자가 선택한 카테고리의 전체 상위 경로를 한 줄로 추출하는 설계 예시입니다.

### 2.1 테이블 구조

```sql
CREATE TABLE categories (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    parent_id INT
);
```

### 2.2 재귀적 경로 쿼리

```sql
WITH RECURSIVE category_path AS (
    SELECT id, name, CAST(name AS CHAR(200)) as full_path, 1 as depth
    FROM categories
    WHERE parent_id IS NULL
    
    UNION ALL
    
    SELECT c.id, c.name, CONCAT(cp.full_path, ' > ', c.name), cp.depth + 1
    FROM categories c
    INNER JOIN category_path cp ON c.parent_id = cp.id
)
SELECT * FROM category_path ORDER BY full_path;
```

---

## 3. 순환 참조(Cycle)와 무한 루프 방지 전략

데이터 구조상 **"A -> B -> A"**와 같은 순환 참조가 발생하면 SQL은 무한 루프에 빠집니다. 이를 방지하기 위한 물리적 제어 방법입니다.

### 3.1 순환 탐지 실현

방문한 경로를 배열이나 문자열에 누적하여 중복 방문 여부를 체크합니다.

```sql
WITH RECURSIVE graph_path AS (
    SELECT id, CAST(id AS CHAR(200)) as path_str, FALSE as is_cycle
    FROM nodes
    WHERE id = 1
    
    UNION ALL
    
    SELECT n.id, CONCAT(gp.path_str, ',', n.id), 
           INSTR(gp.path_str, CAST(n.id AS CHAR)) > 0
    FROM nodes n
    JOIN graph_path gp ON n.parent_id = gp.id
    WHERE NOT gp.is_cycle
)
```

---

## 4. BOM(Bill of Materials)과 원가 계산

완제품부터 원자재까지의 모든 하위 부품을 계층적으로 전계하고, 가격과 수량을 곱해 상위로 누적 합산하는 복잡한 연산에 Recursive CTE가 활용됩니다. 이때 `parent_id`에 인덱스가 없다면 연산 속도가 기하급수적으로 저하되므로 물리적 인덱스 설계가 선행되어야 합니다.

---

## 5. Recursive CTE 최적화 수칙

1. Depth 제약 사수: 예기치 못한 탐색 깊이를 막기 위해 `WHERE depth < 100` 등의 안전장치를 설정합니다.
2. 커버링 인덱스 활용: 재귀 조인에 사용되는 키 칼럼들을 인덱스로 구성하여 물리적 I/O를 최소화합니다.
3. UNION ALL 사용: 중복 제거가 필요 없는 경우 `UNION` 대신 `UNION ALL`을 사용하여 정렬 비용을 없앱니다.
