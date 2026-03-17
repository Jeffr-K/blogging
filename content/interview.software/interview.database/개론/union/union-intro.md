

# union?

JOIN 이 여러 테이블을 옆으로 붙여서 더 많은 정보를 가진 컬럼들을 만드는 기술이었다면 지금부터 배울 UNION 은 여러 개의 결과 집합을 아래로 이어 붙여서 더 많은 행을 가진 하나의 집합으로 만드는 기술이다.

이 개념을 이해하기 위해 오늘의 문제 상황을 살펴보자

"우리 쇼핑몰은 현재 활동 중인 고객을 users 테이블에, 과거에 탈퇴한 고객을 retired_users 라는 별도의 테이블에 보관하고 있다. 연말을 맞아 모든 고객에게 감사 이메일을 보내기 위해 두 테이블에 흩어져 있는 이름과 이메일을 합쳐서 하나의 전체 목록을 만들어야 한다.

이 업무는 JOIN 으로는 해결할 수 없다. 두 테이블은 서로 연결된 관계가 아니라 구조는 비슷하지만 분리 된 별개의 집합이기 때문이다.

### UNION ALL

우리는 UNION 을 사용하여 활동 고객과 탈퇴 고객의 이메일 목록을 하나로 합치는데 성공했다. 그 과정에서 UNION 이 기본적으로 중복된 데이터를 알아서 제거해준다는 아주 중요한 특징을 발견했다. 션 고객이 양쪽 테이블에 모두 있었지만 최종 결과에는 한 번만 포함되었던 것을 기억할것이다.

데이터의 중복을 제거해주는 것은 매우 편리한 기능이지만 항상 우리에게 필요한 기능일까?

여기서 오늘의 문제 상황을 살펴보자.

"마케팅팀에서 두 종류의 고객에게 이벤트 안내 메일을 보내려고 한다. 첫 번째 그룹은 전지기기 카테고리의 상품을 구매한 이력이 있는 고객이고, 두 번째 그룹은 서울에 거주하는 고객이다. 두 그룹의 명단을 합쳐서 전체 발송 목록을 만들고 싶다.

여기서 중요한 질문이 생긴다. 서울에 살면서 전자기기를 구매한 고객은 두 그룹에 모두 속하게 되는데 이 고객을 최종 목록에 한 번만 포함해야 할까? 아니면 중복을 허용해도 될까?

정답은 비지니스 요구사항에 따라 다르다.

##### UNION 과 UNION ALL 의 차이

UNION 과 UNION ALL 의 차이는 '중복 처리' 여부다:

- UNION: 두 결과 집합을 합친 후, 중복된 행을 제거한다.
- UNION ALL: 중복 제거 과정 없이, 두 결과 집합을 그대로 모두 합친다.

UNION 을 활용한 중복 처리:

```sql
select u.name, u.email
from users u
join orders o on u.user_id = o.user_id
join products p on o.product_id = p.product_id
where p.category = '전자기기'

UNION

select name, email
from users
where address like '서울%';
```

UNION 을 활용한 중복이 없이 처리:

```sql
select u.name, u.email
from users u
join orders o on u.user_id = o.user_id
join products p on o.product_id = p.product_id
where p.category = '전자기기'

UNION ALL

select name, email
from users
where address like '서울%';
```

### 실무 가이드: 성능이 핵심이다

그럼 언제 뭘 써야하는가에 대한 답은 성능에 있다.

결론부터 말하면 UNION ALL 이 UNION 보다 훨씬 빠르다.

데이터베이스 입장에서 생각해보면:

- UNION: 두 결과를 합친 뒤 중복을 제거하기 위해 데이터베이스는 보이지 않는 곳에서 추가 작업을 해야한다. 보통 전체 결과를 정렬한 다음, 서로 인접한 행들을 비교하여 중복을 찾아내는 과정을 거친다. 데이터의 양이 수십만, 수백만 건이라면 이 정렬과 비교 작업은 엄청난 비용과 시간을 소모한다.

- UNION ALL: 이런 추가 작업이 전혀 없다. 그냥 첫 번째 SELECT 결과 아래에 두 번째 SELECT 결과를 가져다 붙이기만 하면 된다.

실무에서는:

- 중복을 제거해야만 하는 명확한 요구사항이 있을 때만 UNION 을 사용한다(예: 고유한 이메일 주소 목록, 고유한 고객 ID 목록)

- 그 외의 모든 경우에는 UNION ALL 을 우선적으로 사용한다.

### UNION 정렬

UNION 또는 UNION ALL 을 사용하여 여러 SELECT 문의 결과를 합칠 때 최종 결과 집합에 대해 정렬을 적용할 수 있다. 이때 ORDER BY 절의 위치가 중요하다.

ORDER BY 절은 전체 UNION 연산의 가장 마지막에 한 번만 사용해야 한다. 만약 각 SELECT 문 안에 ORDER BY 를 사용하면 에러가 발생하거나 예상과 다른 결과가 나올 수 있다. 왜냐하면 UNION 은 각 SELECT 문의 개별적인 정렬 순서가 아니라 합쳐진 최종 결과 전체에 대한 순서를 결정해야 하기 때문이다.

예를 들어 활동 고객과 탈퇴 고객의 명단을 합친 후 이름을 기준으로 오름차순 정렬하고 싶다고 가정해보자.

```sql
$ select name, email from users
UNION
select name, email from retired_users
order by name;
```

##### UNION 에 나오지 않는 필드를 사용한다면?

UNION 또는 UNION ALL 연산의 ORDER BY 절에서는 첫번째 SELECT 문의 컬럼 이름이나 해당 컬럼의 별칭만 사용할 수 있다. 이는 UNION 결과 집합의 컬럼 이름이 첫번째 SELECT 문을 따르기 때문이다.

```sql
select name, email, created_at from users
UNION
select name, email, retired_date from retired_users
order by retired_date;
```

### 별칭 사용하기

다음의 created_at, retired_date 과 같이 이름이 다른 컬럼이 있다면 별칭을 사용하는 것을 권장한다.

나중에 쿼리를 다시 보거나 다른 개발자가 볼 때, created_at 이라는 이름만으로는 retired_date 도 포함하여 정렬된다는 사실을 즉시 파악하기 어려울 수 있기 때문이다. event_date 와 같은 중립적인 별칭은 해당 컬럼이 여러 종류의 날짜 정보를 담고 있음을 명확하게 보여준다.

```sql
select name, email, created_at as event_date from users
UNION
select name, email, retired_date as event_date from retired_users
order by event_date DESC;
```
