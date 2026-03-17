

# 
이제 시선을 바꿔보자. 만약 서브 쿼리를 SELECT 절 안으로 가져온다면 어떻게 될까

### 비상관 서브 쿼리

### 상관 서브 쿼리

```sql
select
    p.product_id,
    p.name,
    p.price,
    (select count(*) from orders o where o.product_id = p.product_id) as order_count
from
    products p;
```

### 실무 팁: 성능에 주의해라

스칼라 서브 쿼리는 이처럼 JOIN 으로는 표현하기 복잡한 로직을 직관적으로 표현할 수 있게 해주지만, 강력한 만큼 주의해야한다.

가장 큰 단점은 성능 저하의 가능성이다. 특히 상관 서브쿼리는 메인쿼리가 반환하는 행의 수만큼 서브 쿼리가 반복 실행되기 때문이다. 만약 products xpdlqmfdp 100만개의 상품이 있다면 주문 횟수를 알기 위해 COUNT(*) 쿼리가 100만번이나 실행되는 셈이다. 이는 데이터베이스에 엄청난 부하를 줄수 있다.

사실 오늘의 문제 상황은 LEFT JOIN 과 GROUP BY 를 사용해서도 해결할 수 있으며 대부분의 경우 데이터베이스 옵티마이저가 JOIN 을 더 효율적으로 처리하여 성능이 더 좋다.

```sql
$ SELECT p.product_id, p.name, p.price, COUNT(o.order_id) AS order_count
  FROM products p
  LEFT JOIN orders o ON p.product_id = o.product_id
  GROUP BY p.product_id, p.name, p.price
```

그럼에도 불구하고 스칼라 서브 쿼리는 JOIN 이 너무 복잡해지거나 완전히 다른 테이블에서 간단한 정보 하나만 조회해 올 때 코드를 훨씬 명료하게 만들어주는 장점이 있어 적재적소에 사용하면 매우 유용하다.
