# SQL 기초 가이드 (SQL Fundamentals)

안녕하세요! 10년 차 SQL 전문가가 입문자분들을 위해 준비한 SQL 기초 가이드입니다.
단순한 문법 나열이 아니라, 실제 **커머스 서비스(주문, 상품, 회원)**에서 이 키워드들이 왜 쓰이고 어떻게 활용되는지 중심으로 정리했습니다.

아래 단계별로 학습하시면 실무 데이터 활용 능력을 빠르게 키우실 수 있습니다.

---

## 📚 단계별 학습 목차

### [1. 데이터 조회 기초 (DQL)](./01-dql-retrieval.md)

가장 많이 쓰게 될 데이터 읽기 기술입니다. 특정 조건의 데이터를 뽑고 정렬하는 방법을 배웁니다.

- `SELECT`, `DISTINCT`, `WHERE`, `ORDER BY`, `LIMIT`

### [2. 데이터 변경 기초 (DML)](./02-dml-modification.md)

데이터를 새롭게 넣고, 수정하고, 지우는 방법입니다.

- `INSERT`, `UPDATE`, `DELETE`, `INSERT INTO SELECT`

### [3. 집계와 그룹화 (Aggregation)](./03-aggregation-grouping.md)

개별 데이터들을 모아서 전체 매출이나 평균 등 통계 수치를 뽑는 방법입니다.

- `COUNT`, `SUM`, `AVG`, `GROUP BY`, `HAVING`

### [4. 조인과 집합 (Joins & Sets)](./04-joins-relationships.md)

여러 테이블에 흩어진 정보를 하나로 합쳐서 보는 고급 조회 기술입니다.

- `INNER JOIN`, `LEFT JOIN`, `SELF JOIN`, `UNION`

### [5. 유연한 필터링과 조건 로직](./05-filtering-logic.md)

비즈니스 로직을 쿼리에 녹여 복잡한 필터링이나 조건부 결과값을 만드는 방법입니다.

- `LIKE`, `IN`, `BETWEEN`, `CASE`, `COALESCE`

### [6. 데이터 정의와 제약 조건 (DDL)](./06-ddl-table-management.md)

데이터를 담는 테이블 자체를 설계하고 무결성을 유지하는 규칙을 정하는 방법입니다.

- `CREATE`, `ALTER`, `DROP`, `Constraints`, `INDEX`

### [7. 보안과 고급 객체 (Security & Objects)](./07-security-objects.md)

데이터 보안(SQL Injection)과 효율적인 쿼리 관리를 위한 고급 기능을 배웁니다.

- `Prepared Statements`, `Views`, `Stored Procedures`

---

> [!TIP]
> 처음에는 **1번(DQL)**과 **3번(집계)**을 가장 먼저 익히시는 것을 추천합니다. 실무에서 데이터를 분석하거나 리포트를 만들 때 80% 이상의 비중을 차지하기 때문입니다.
