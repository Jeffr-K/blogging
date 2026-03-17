

# Introduction to Table Sub QUery

FROM 절에 위치하는 서브 쿼리는그 실행 결과가 마치 하나의 독립된 가상 테이블처럼 사용되기 때문에 테이블 서브 쿼리라 한다. 서브 쿼리 내에서 인라인으로 즉석에서 정의되는 뷰와 같다고 해서 인라인 뷰라고도 부른다

테이블 서브쿼리의 가장 큰 특징은 우리가 지금까지 배운 복잡한 셀렉트 문의 결과를 하나의 명확한 데이터 집합으로 먼저 만들어놓고 그 집합을 대상으로 다시 한번 SELECT 를 할 수 있게 해준다는 점이다

이 개념을 제대로 이해하기 위해 GROUP BY 

```sql
select category, max(price) -- name 을 추가할 수 없음
from products
group by category; -- name 을 추가할 수 없음, 정렬의 기준이 모호해지기 때문에
```

# 인라인 뷰를 이용한 2단계 접근법

```sql
select category, max(price) as max_price
from products
group by category;
```

### 원본 테이블과 가상 테이블 조인

```sql
select 
    p.product_id,
    p.name,
    p.price,
    p.category
from products p
join (
        select category, max(price) as max_price
        from products
        group by category
     ) cmp
on p.category = cmp.category and p.price = cmp.max_price;
```

### FROM 절의 상관 서브 쿼리 - LATERAL

FROM 절에서 상관 서브 쿼리를 사용하려면 LATERAL 키워드를 사용해야 한다. 이 기능은 너무 복ㅈ바하고 성능이 잘 나오지 않는 문제가 있어서 실무에서는 잘 사용하지 않는 편이다. 따라서 여기서는 따로 설명하지 않겠다.

### 결론

##### JOIN 을 우선적으로 고려하라

##### JOIN 으로 표현하기 너무 복잡하거나, 서브 쿼리의 가독성이 훨씬 좋다면 서브 쿼리를 사용하라

##### EXISTS 를 활용하라

##### 성능이 의심될 때는 반드시 측정하라
