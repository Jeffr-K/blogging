
# VIEW

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

이 쿼리는 매우 유용해서 우리 쇼핑몰의 재무팀, 마케팅팀, 운영팀에서 매일 아침 확인해야 하는 핵심 지표라고 가정해보자. 여기서 오늘의 문제 상황이 발생한다.

- 복잡성: 이 쿼리는 너무 길고 복잡하다. SQL 에 익숙하지 않은 직원이 이 쿼리를 매번 실수 없이 정확하게 입력하기란 거의 불가능에 가깝다.
- 재사용성: 여러 팀의 여러 사람이 이 쿼리를 사용하려면, 각자 이 긴 쿼리문을 어딘가에 저장해두고 복사-붙여넣기를 해야한다.
- 보안: 이 쿼리를 실행하려면, 사용자는 원본 테이블인 orders 와 products 에 직접 접근할 수 있는 권한(SELECT 권한)이 있어야 한다.
       하지만 운영팀 직원에게는 고객의 개인정보나 상품의 원가 같은 민감한 정보가 담겨 있을 수 있는 원본 테이블 전체를 보여주고 싶지 않다. 딱 이 요약된 보고서 내용만 보게 하고 싶다.

이 모든 문제를 해결해주는 도구가 VIEW 이다.

### 뷰의 개념

뷰는 실제 데이터를 가지고 있지 않은 가상의 테이블이다. 실체는 데이터베이스 이름과 함꼐 저장된 하나의 SELECT 쿼리문이다.

뷰는 그 자체로 데이터를 저장하는 테이블이 아니다. 단지 복잡한 SELECT 쿼리문 자체를 저장하고 있다.

따라서 우리는 복잡한 쿼리를 실행할 필요 없이 SELECT * FROM 나의 바로가기 뷰; 라는 명령만으로 그 복잡한 쿼리의 결과를 얻을 수 있다.

### 동작 원리


### 뷰를 사용하는 이유

- 편리성:
- 보안성:
- 논리적 독립성:

### 예제

##### 생성

##### 수정

##### 삭제

##### 조회

### 실무적 관점: 뷰는 언제 써야하고 언제 쓰지 말아야할까?
