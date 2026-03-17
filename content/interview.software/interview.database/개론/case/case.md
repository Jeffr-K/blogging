

### CASE 문의 두 가지 종류

##### 단순 CASE 문

#####

### 검색 CASE 문 사용시 주의사항: WHEN 절의 순서

앞서 CASE 문은 위에서 아래로 순차적으로 평가하며 가장 먼저 참이 되는 조건을 만나느 순간 실행을 멈춘다고 강조했다.

이 점이 검색 CASE 문에서는 특히 중요하다. 만약 조건을 잘못 배치하면 예상과 다른 결과가 나올 수 있다.

만약 위 쿼리에서 WHEN price >= 30000 조건을 WHEN price >= 100000 조건보다 먼저 배치했다면 어떻게 될까?

```sql
$ SELECT
    name,
    price,
    CASE
        WHEN price >= 30000 THEN '중가'
        WHEN price >= 100000 THEN '고가'
        ELSE '저가'
    END AS price_label
FROM
    products;
```

결과를 실행하면 10만원에 도달하지 못한채 전부 중가 제품이 된다.

```sql
$ SELECT
    name,
    price,
    CASE
        WHEN price >= 100000 THEN '고가'
        WHEN price >= 30000 THEN '중가'
        ELSE '저가'
    END AS price_label
FROM
    products;
```

조건의 순서를 잘 정해야 한다.

### CASE 문과 사용 위치

`ORDER BY` 키워드도 CASE 구문을 사용할 수 있다.

```sql
$ SELECT
    name,
    price,
    CASE
        WHEN price >= 100000 THEN '고가'
        WHEN price >= 30000 THEN '중가'
        ELSE '저가'
    END AS price_label
FROM
    products
ORDER BY
    CASE
        WHEN price >= 100000 THEN 1
        WHEN price >= 30000 THEN 2
        ELSE 3
    END ASC,
    price ASC;
```

### CASE 문 그룹핑

CASE 문의 진정한 힘은 이렇게 동적으로 만들어 낸 값을 다른 SQL 구문과 결합할 때 드러난다. CASE 문과 GROUP BY 를 함께 사용하여 데이터를 우리가 원하는 기준으로 분류하고, 분류된 그룹별로 통계를 내는 실용적인 기술을 배워보겠다.

오늘의 문제 상황이다:

고객들을 출생 연대에 따라 1990년대생, 1980년대생, 그 이전 출생으로 분류하고 각 그룹에 고객이 총 몇명씩 있는지 알고 싶다.

이 문제를 해결하기 위한 전략은 두 단계로 나뉜다.

- 분류: CASE 문을 사용해 각 고객에게 '1990년대생', '1980년대생', '그 이전 출생' 중 하나의 라벨을 붙여준다.
- 집계: 1단계에서 만들어진 라벨을 기준으로 GROUP BY 하고, COUNT 함수를 사용해 각 라벨(그룹)에 속한 고객 수를 센다.


##### 1단계: 분류

```sql
SELECT
    name,
    birth_date
    CASE
        WHEN year(birth_date) >= 1990 THEN '1990년대생'
        WHEN year(birth_date) >= 1980 THEN '1980년대생'
        ELSE '그 이전 출생'
    END AS birth_decade
FROM users u

```

### 2단계: 집계

```sql
SELECT
    CASE
        WHEN year(birth_date) >= 1990 THEN '1990년대생'
        WHEN year(birth_date) >= 1980 THEN '1980년대생'
        ELSE '그 이전 출생'
    END AS birth_decade,
    COUNT(*) as customer_count
FROM users
GROUP BY 
    birth_decade;
```

mysql 만 지원되는 기능이다. 원칙적으로는 SELECT 가 후순위라서 birth_decade 를 GROUP BY 에서는 연산의 결과를 알 수 없다. 최신 버전의 많은 데이터베이스는 사용자 편의를 위해 이러한 별칭 사용을 예외적으로 사용한다.


### CASE 문 조건부 집계

CASE 문이 집계 함수(SUM, COUNT 등)의 안으로 들어가는 훨씬 더 강력한 활용법을 배워본다.

이 기법을 조건부 집계(Conditional Aggregation)라고 한다.

오늘의 문제 상황이다(엑셀의 피벗 테이블과 같은 유사한 보고서를 SQL 로 직접 만들어보는 것이다):

"하나의 쿼리로, 전체 주문 건수와 함께 "결제 완료(COMPLETED)", "배송(SHIPPED)", "주문 대기(PENDING)" 상태의 주문이 각각 몇 건인지 별도의 컬럼으로 나누어보고 싶다.

> 피벗 테이블(Pivot Table)
>
> 피벗 테이블이라는 이름은 데이터를 다양한 관점에서 회전(pivot)시켜 분석할 수 있는 기능때문에 붙여진 이름이다.

이 문제를 해결하기 위해 단계별로 접근해보자:

##### 1단계

UNION ALL 을 사용하는 방법:

```sql
SELECT status, count(*)
FROM orders
GROUP BY status
```

```sql
SELECT
    "Total" as category,
    COUNT(*) AS count 
FROM orders
UNION ALL
SELECT 
    status AS category
    COUNT(*) AS count 
FROM orders
GROUP BY status;
```

서브쿼리를 사용하는 방법:

```sql
SELECT
    (SELECT count(*) FROM orders) as total_orders,
    (SELECT count(*) FROM orders where status = 'COMPLETED') as completed_count,
    (SELECT count(*) FROM orders where status = 'SHIPPED') as shipped_count,
    (SELECT count(*) FROM orders where status = 'PENDING') as pending_count;
```

이 방법은 성능상 심각한 문제가 있다. 각 값을 얻기 위해 4번의 조회를 진행한다. 데이터가 많아질수록 매우 비효율적이다.

##### CASE 문을 품은 집계 함수

이 문제를 해결하는 핵심 아이디어는 집계 함수의 인자로 CASE 문을 넣어 조건에 맞을 때만 세거나 더하게 만드는 것이다. 두가지 대표적인 패턴이 있다.

패턴 1: COUNT(CASE ...)

카운트 함수는 NULL 이 아닌 모든 값을 센다는 특징을 이용한다.

```sql
SELECT COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)
```

- status 가 'COMPLETED' 이면 CASE 문은 1을 반환한다.
- 그 외의 경우, CASE 문은 NULL 을 반환한다.(ELSE 가 없으므로)
- 결과적으로 COUNT 함수는 status 가 "COMPLTED" 인 행의 개수만 세게 된다.

패턴 2: SUM(CASE ...)

SUM 함수는 숫자들의 합계를 구한다.

```sql
SELECT SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)
```

- status 가 'COMPLETED' 이면 CASE 문은 1을, 그 외에는 0을 반환한다.
- SUM 함수가 이 1과 0들을 모두 더하면 그 합계는 결국 'COMPLETED' 상태인 주문의 총 개수가 된다.


```sql
SELECT
    COUNT (*) as total_orders,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0) as complted_count,
    SUM(CASE WHEN status = 'SHIPEED' THEN 1 ELSE 0) as shipped_count,
    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0) as pending_count
FROM orders;
```

위 쿼리는 orders 를 한번만 조회해서 각 집계 함수를 돌린 결과를 반환하여 피봇 테이블을 구성한다.

##### 2단계: GROUP BY 와 함께 사용하기 (피봇 테이블 구성)

```sql
SELECT
    p.category,
    COUNT (*) as total_orders,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0) as complted_count,
    SUM(CASE WHEN status = 'SHIPEED' THEN 1 ELSE 0) as shipped_count,
    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0) as pending_count
FROM orders o
JOIN 
    product p on o.product_id = p.product_id
GROUP BY
    p.category;
```

이제 우리는 카테고리별로 주문 현황을 훨씬 더 상세하고 입체적으로 분석할 수 있게 되었다. 전자기기는 주문은 많지만 배송상태이거나 대기중인 건이 많은 반면, 도서는 주문 건수는 적지만 모두 처리가 완료되었다는 인사이트를 단번에 얻을 수 있다.

이처럼 CASE 문을 집계 함수 내부에 사용하는 조건부 집계 기법은 데이터를 단순히 요약하는 것을 넘어 원하는 형태로 재구조화하고 분석하는데 필요한 도구다.

방금 우리가 만든 카테고리별 주문 현황 쿼리는 매우 유용해서 재무팀이나 마케팅팀에서 매일 같이 필요로 할 수 있다. 하지만 이 복잡한 쿼리를 마치 하나의 간단한 테이블처럼 데이터베이스에 저장해두고, 필요할 때마다 `SELECT * FROM daily_report;` 처럼 쉽게 불러와 쓸 수는 없을까?

다음 섹션에서는 이 문제를 해결해 줄 마법 같은 가상 테이블, 뷰(VIEW)에 대해서 알아보자.


















```sql
SELECT COUNT(user_id)
FROM users u
WHERE 
    CASE
        WHEN u.birth = '1990' THEN
        WHEN u.birth = '1980' THEN
        ELSE
    END
GROUP BY birth
ORDER BY birth DESC;
```
