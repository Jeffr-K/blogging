---
title: "[DB Master] 6. 뷰(View)와 윈도우 함수: 데이터의 투영과 분석"
author: jeffrey
date: 2026-04-07
tags: ["sql", "view", "materialized-view", "window-function", "rank", "lead-lag", "running-total", "optimization"]
---

## 뷰(View)와 윈도우 함수: 데이터의 논리적 캡슐화와 분석

SQL은 단순히 데이터를 꺼내오는 도구를 넘어, 데이터를 논리적으로 캡슐화하여 보안과 가독성을 높이는 **뷰(View)**, 그리고 행 사이의 관계를 파헤쳐 실시간 순위와 추이를 분석하는 **윈도우 함수(Window Function)**라는 강력한 기능을 제공합니다.

뷰의 물리적 한계와 최적화, 그리고 분석 작업에 필수적인 윈도우 함수의 작동 원리를 분석합니다.

---

## 1. 뷰(View): 조인의 복잡성을 감춘 가상 테이블

뷰는 실제 데이터를 디스크에 저장하지 않고, 복잡한 `SELECT` 문의 **정의만 저장**하고 있는 논리적 테이블입니다.

### 1.1 뷰의 도입 배경과 장점

- **가독성과 재사용성**: 수십 줄에 달하는 복잡한 조인 쿼리를 하나의 이름으로 가려(Abstract) 단순화합니다.
- **보안성**: 실제 테이블의 특정 칼럼만 노출하거나, 행 단위 권한 제어를 걸어 데이터 오남용을 방지합니다.
- **독립성**: 원본 테이블 구조가 바뀌어도 뷰 이름(Alias)은 그대로 유지하여 애플리케이션 코드 수정을 최소화합니다.

---

## 2. 구체화된 뷰 (Materialized View)

일반 뷰가 매번 쿼리를 실행한다면, **구체화된 뷰(MVIEW)**는 쿼리 결과를 실제 디스크 테이블로 저장합니다.

- **용도**: 대규모 통계 데이터(전일 매출 등)를 실시간 계산하기엔 너무 무거울 때 활용합니다.
- **한계**: 원본 테이블이 바뀌면 MVIEW도 갱신(Refresh)해야 합니다. MySQL은 기본 제공하지 않으며 별도 설계가 필요하지만, Oracle이나 PostgreSQL은 지원합니다.

---

## 3. 윈도우 함수(Window Function) 실전 활용

윈도우 함수는 '그룹화'를 하면서도 '행을 합치지 않는' 독특한 연산입니다.

### 3.1 윈도우 함수의 구조

- **OVER**: 윈도우 연산을 선언하는 지점입니다.
- **PARTITION BY**: 데이터를 어느 단위로 묶을 것인가 결정합니다.
- **ORDER BY**: 묶인 데이터 안에서 순서를 어떻게 정할 것인가 결정합니다.

### 3.2 실전 예시: RANK와 LEAD/LAG

```sql
-- 1. 순위 계산 (RANK)
SELECT student_name, score,
       RANK() OVER (PARTITION BY class_id ORDER BY score DESC) as rank
FROM exam_results;

-- 2. 이전 행 데이터 참조 (LAG)
SELECT visit_date, visit_count,
       LAG(visit_count) OVER (ORDER BY visit_date) as prev_day_count
FROM daily_stats;
```

---

## 4. 이동 평균과 누적 합계 (Running Total)

이커머스 매출 대시보드나 금융 서비스의 자산 추이 분석에서 쓰이는 핵심 기술입니다.

```sql
SELECT visit_date, visit_count,
       SUM(visit_count) OVER (ORDER BY visit_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as running_total
FROM traffic_logs;
```

---

## 5. 윈도우 함수 최적화 수칙

1. 메모리 점유 주의: 윈도우 함수는 결과 데이터를 다시 정렬하고 버퍼를 메모리에 올려야 합니다. 데이터량이 수백만 건 이상이면 임시 테이블(Temp Table) 오버헤드가 발생합니다.
2. 인덱스 활용 필수: `PARTITION BY`와 `ORDER BY`에 사용된 칼럼들이 인덱스로 구성되어 있다면 엔진은 추가 정렬 없이 윈도우 함수를 처리할 수 있습니다.
3. 쿼리 복잡도 관리: 하나의 쿼리에 너무 많은 윈도우 함수를 넣으면 옵티마이저가 최적의 실행 계획을 찾기 어려워집니다.
