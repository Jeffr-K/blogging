---
title: "PostgreSQL Indexes"
date: 2023-01-01
tags: ["postgresql", "database", "index"]

---

# Introduction to PostgreSQL Indexes

PostgreSQL 은 B-tree 인덱스 외에도 BRIN(Block Range Index)와 GIN, GiST, 해시 인덱스 등의 다양한 인덱스 유형을 제공한다.

## Varieties of PostgreSQL Indexes

### B-Tree Index

가장 기본적이고 널리 사용되는 인덱스이다. 데이터를 정렬된 상태로 유지하며 등호(=) 및 범위 조회(`>`, `<`, `BETWEEN`)를 지원한다.

일반적인 데이터인 숫자형, 문자열, 날짜와 같은 데이터 검색에 효율적이다.

### Hash Index

단일 값의 일치 여부(`=`)만 확인하는데 특화되어 있다. B-Tree 보다 특정 상황에서 빠를 수 있지만, 범위 검색이나 정렬에는 사용할 수 없다.

단순 동등 비교에 특화되어 있다.

### GIN (Generalized Inverted Index)

역색인 구조로 하나의 컬럼에 여러개의 값이 들어있는 데이터 -- 배열, JSONB, 전문검색(Text) -- 를 다루는 데 최적화 되어 있다.

배열 내 요소 검색이나 JSONB 데이터 내 키/값 검색, 전체 텍스트 검색(FTS)에 특화되어 있다.

### GiST (Generalized Search Tree) Index

복잡한 데이터 구조를 위해 설계된 균형 트리(Binary Search Tree)로, 특히 2차원 평면상의 도형이 겹치는지, 포함되는지 등의 기하학적 연산에 강점이 있다.

지리 정보(PostGIS), 기하학적 도형, 근접 이웃 검색(KNN) 등에 특화되어 있다.

### BRIN (Block Range Index)

데이터 블록의 범위를 요약하여 저장하는 방식이다. 데이터가 물리적으로 특정 순서(예: 시계열 데이터의 날짜)대로 쌓여 있을 때 매우 효율적이다.

초대용량 테이블(로그 또는 센서 데이터 등)에서 인덱스 크기를 획기적으로 줄이고 싶을 때 사용할 수 있다.

### SP-GiST (Space-Partitioned GiST)

공간을 비대칭적으로 분할하는 구조(Quad-tree, Patricia tree 등)를 사용한다. 데이터가 균일하게 분포되어 있지 않을 때 유리하다.

전화번호나 IP 주소, 비정형 기하학 데이터에 강점이 있다.

### 부분 인덱스 (Partial Index)

특정 조건을 만족하는 행에 대해서만 인덱스를 생성한다.

헬스장 SaaS에서 "활성화된(Active) 회원"만 검색하는 경우가 많다면, WHERE status = 'ACTIVE'인 데이터만 인덱스로 만듭니다. 인덱스 크기가 줄어들고 성능은 올라가게 된다.

### 표현식 인덱스 (Expression Index)

함수나 수식의 결과에 인덱스를 거는 도구다.

`lower(email)` 로 인덱스를 걸면 대소문자 구분 없는 검색이 매우 빨라집니다.

### 커버링 인덱스 (Covering Index)

인덱스 리프 노드에 실제 컬럼 값을 미리 포함시켜, 테이블(Heap)까지 가지 않고 인덱스만 보고 결과를 반환한다.

## 인덱스의 동작 원리

### PostgreSQL 인덱스 구조의 핵심: Heap Table

MySQL(InnoDB)은 데이터 자체가 인덱스(PK)에 묶여 있는 구조지만, PostgreSQL은 Heap Table 구조를 사용한다.

- MySQL: 클러스터 인덱스(PK) 리프 노드에 실제 데이터 행(Row)이 들어있음.

- PostgreSQL: 데이터 행은 별도의 Heap 영역에 무작위로 저장되고, 인덱스는 그 데이터의 물리적 주소값인 *TID(Tuple ID)* 만 가진다.

> [info] PostgreSQL 에도 `CLUSTER` 명령어가 있지만, 이는 일회성으로 데이터를 정렬할 뿐 데이터 삽입 시 순서를 유지해주지 않는다.

## Query Optimizer 와의 상관 관계

## 인덱스 생성 방법

PostgreSQL 에서 B-tree 인덱스는 세 가지 방법으로 생성할 수 있다.

- `create index` 명령어를 사용하여 인덱스를 생성할 수 있다.
- `create index ... include` 명령어를 사용하여 인덱스를 생성할 수 있다.
- `create index ... where` 명령어를 사용하여 인덱스를 생성할 수 있다.

이 중 `INCLUDE` 와 `WHERE` 조건절 생성 방식은 성능 튜닝 작업에서 매우 유용하게 활용된다.

`INCLUDE` 절은 커버링(Covering) 인덱스를 통해 테이블 랜덤 엑세스를 제거할 때 사용한다. INCLUDE 절에 지정된 컬럼은 인덱스에는 포함되지만,

검색 조건에는 사용되지 않는다는 특징이 있다.

`WHERE` 절은 `Partial Index` 라고도 하며, 조건에 해당하는 레코드만 인덱스에 포함시킨다. 이 방식은 데이터 분포도 차이가 큰 컬럼이나 복잡한 조건이 포함된 쿼리의 성능을 개선할 때 효과적으로 사용할 수 있다.

인덱스는 다음과 같은 방법으로 생성한다:

```sql
create index <index_name> on <schema_name>.<table_name> (column_name);
```

### 검색 CIC (Create Index Concurrently)

<u>데이터베이스 운영 중에 쿼리 성능 개선을 위해서 신규 인덱스를 생성한다고 가정해보자. 인덱스 생성 시 업무 트랜잭션과의 락 충돌때문에 락 대기 현상이 발생한다.</u>

이 문제를 해결하기 위해 대부분의 DBMS 는 인덱스 생성을 위한 온라인 기능을 제공한다. 온라인 기능이란 트랜잭션 수행과 무관하게 인덱스를 생성할 수 있는 기능이다.

PostgreSQL 은 `CONCURRENTLY` 키워드를 사용하여 온라인 기능을 지원하는데, 트랜잭션이 빈번한 테이블에 인덱스를 생성할 때는 CIC 옵션을 사용하도록 한다.

### CIC 옵션의 장단점

CIC 옵션은 락 경합 문제를 해소할 수 있다는 장점이 있지만 다음과 같은 단점이 있다.

##### 일반 인덱스 생성 방식에 비해 속도가 느리다

CIC 옵션을 사용하면 테이블을 두 번 스캔하게 된다.

스캔 중에 트랜잭션이 진행 중인 레코드가 있으면 해당 트랜잭션이 종료될 때까지 인덱스 생성 작업을 중단하고 트랜잭션이 종료되면 인덱스 생성 작업을 재개한다.

이러한 이유로, 트랜잭션이 빈번하게 발생하는 테이블에 CIC 옵션을 사용하면 일반적인 방식에 비해 인덱스 생성 속도가 느리다.

다만, 생성 속도가 느린 것이 락 경합 문제를 회피할 수 있다는 장점에 비하면 상대적으로 사소한 단점이다.

CIC 옵션을 사용할 때 테이블을 두 번 스캔하는 이유:

- 첫번째 스캔에서는 테이블의 레코드를 읽어 정렬한 후, 이를 인덱스 트리 구조에 입력한다. 이 과정은 CIC 옵션 없이 생성하는 경우와 동일하다.
이 시점부터는 신규 인덱스에 레코드를 추가하거나 삭제할 수 있다.

- CIC 옵션은 인덱스 생성 도중에도 트랜잭션 처리를 허용하므로 첫번째 테이블 스캔 시에 발생한 트랜잭션 중에서 인덱스에 반영되지 않은 레코드가 존재할 수 있다.
따라서 두 번째 스캔 시 이들 레코드를 인덱스에 반영하게 된다.

##### INVALID 상태의 인덱스가 생성될 수 있다

CIC 옵션을 사용하면 명령어 시작 시점에 인덱스 메타 정보가 시스템 카탈로그에 등록되며, 이때 상태는 INVALID 로 설정된다. 이후 인덱스 생성이 정상적으로 완료되면 해당 상태를 VALID 로 변경한다. 이는 CIC 옵션 없이 인덱스를 생성할 때, 인덱스 생성이 완료된 후에 메타 정보를 등록하는 방식과는 차이가 있다.

이러한 특성으로 인해 인덱스 생성 세션이 비정상적으로 종료되거나, 유니크 인덱스를 CIC 옵션으로 생성할 때 중복 값에 의해 오류가 발생하는 경우, 해당 인덱스는 INVALID 상태로 남게 된다. INVALID 상태의 인덱스는 쿼리 수행에 활용되지 못할 뿐 아니라 디스크 공간을 차지하고 DML 작업 시에도 반영이 된다는 문제가 있다.

확인해보자:

```sql
$ set role svc;

$ drop table if exists svc.example1;

$ create table svc.example1 (col1 integer, col2 varchar(10));

$ insert into svc.example1 select i, 'N' from generate_series(1, 1000000) i;

$ \dt+ svc.example1

```

`CIC` 옵션으로 인덱스를 생성하는 도중 세션을 강제 종료하면 `INVALID` 상태의 인덱스가 생성된다. `\di+` 명령으로 인덱스를 확인해보면 `INVALID` 상태의 인덱스도 디스크 공간을 차지하는 것을 확인할 수 있다.

```sql
$ create index concurrently example1_n1 on svc.example1 (col1);
```

```sh
$ cmd + c

$ \d+ svc.example1

$ \di+ svc.example1_n1
```

CIC 옵션을 사용해 유니크 인덱스를 생성할 때 발생할 수 있는 문제를 들 수 있다.

```sql
$ drop index svc.example1_n1;

$ create unique index concurrently example1_uk on svc.example1 (col1); -- 생성 진행중
```

인덱스 생성 중 다른 세션에서 유니크 제약 조건에 위배되는 중복 키 값을 입력한다.

```sql
insert into svc.example1 values(1, 'dup record');
```

인덱스 생성의 마지막 단계에서 유니크 키 중복 오류가 발생하면 인덱스는 INVALID 상태로 남게 된다.

```sh
ERROR: duplicate key value violates unique constraint "example1_uk"

상세 정보: Key (col1)=(1) already exists.

$ \d+ svc.example1

$ \di+ svc.example1_uk
```

##### 인덱스 생성이 지연되는 현상이 발생할 수 있다

CIC 옵션으로 인덱스를 생성할 때 가장 주의해야 할 점이다. 앞서 설명한 것처럼 CIC 옵션을 사용할 경우 테이블을 두 번 스캔한다.

만약 두 번째 스캔 이전에 실행된 쿼리가 인덱스 생성 완료 시점까지도 수행 중이라면, 인덱스 생성을 완료하지 못하고 해당 쿼리의 종료를 대기한다.

이 때 해당 쿼리가 인덱스 대상 테이블을 엑세스하지 않더라도 CIC 옵션으로 인덱스를 생성하는 세션은 락 대기를 한다는 점에 유의해야 한다.

```sql
select pg_sleep(1000000);
```

이후 CIC 옵션을 사용해서 인덱스를 생성한다.

```sql
$ drop index svc.example1_uk;

$ create index concurrently example1_n1 on svc.example1 (col1); -- 인덱스 생성 중
```

세션 및 인덱스 진행 상황 모니터링 뷰를 통해 CIC 수행 세션이 다른 세션의 쿼리 종료를 기다리고 있음을 확인할 수 있다.

따라서 CIC 옵션을 사용할 때는 세션 및 인덱스 진행 상황을 모니터링 할 필요가 있다. 만약 인덱스 생성을 지연시키는 세션이 업무용 트랜잭션이 아니라면,

해당 세션을 정리해서 인덱스 생성이 정상적으로 완료되도록 해야한다.

> CIC 옵션을 사용한 인덱스 생성 작업은 테이블 당 한 번에 하나만 수행할 수 있다. 따라서 하나의 테이블에 두 개 이상의 인덱스를 CIC 옵션으로 생성할 때는 순차적으로 수행해야 한다.

### 인덱스 리빌드

테이블에 대해 `VACUUM FULL` 명령어를 수행하면 *인덱스 블로팅 문제*도 함께 해결되므로 주기적으로 `VACUUM FULL` 을 수행하는 것이 좋다.

> ![info] 인덱스 블로팅 (Index bloating) 문제란?
>
> 인덱스 블로팅 문제는 인덱스 내부에 사용되지 않는 빈 공간(Dead Space)이 비정상적으로 많이 생기는 현상을 말한다. PostgreSQL 의 MVCC(Multi-Version Concurrency Control) 모델 때문인데, 데이터를 UPDATE 하거나 DELETE 하면 실제 행이 삭제되는 것이 아니라 죽은 행(Dead Tuple)로 표시된다. 인덱스 포인터 역시 마찬가지로 죽은 상태가 되며 이 공간이 즉각 재사용되지 못하고 쌓이면서 인덱스 파일 크기가 실제 데이터보다 커지게 된다. 이로 인해 인덱스가 비대해지면 디스크 I/O 부하가 증가하고 캐시 효율이 떨어져 쿼리 성능이 저하되게 된다.

> ![warn] VACUUM FULL, 왜 주의해야 할까?
>
> VACUUM FULL 이 인덱스 블로팅을 완벽히 해결하는 것은 맞지만 다음과 같은 치명적인 단점이 있다.
>
> - 배타적 잠금(Exclusive Lock): 해당 테이블에 `ACCESS EXCLUSIVE` 락을 건다. 다시 말하면 VACUUM FULL 이 진행되는 동안 해당 테이블에 대한 모든 읽기와 쓰기가 불가능하다. 이는 서비스 중단이 될 수 있는 위험한 상황에 놓여지게 된다.
> - 리소스 소모: 테이블을 통째로 새로 복사해서 만들기 때문에 디스크 공간이 테이블 크기의 2배만큼 필요하며 CPU 와 I/O 소모가 극심하다.
>
> 따라서 실무에서는 VACUUM FULL 대신 `REINDEX CONCURRENTLY` 명령어를 사용한다. 이 명령어는 인덱스를 복사하면서 동시에 테이블에 대한 읽기와 쓰기를 허용한다. 이는 서비스 중단이 없이 인덱스를 관리할 수 있게 해준다.

인덱스 리빌드 작업은 테이블에 생성된 모든 인덱스를 한꺼번에 수행할 수도 있고, 개별 인덱스 단위로도 진행할 수 있다.

이때, 인덱스 생성과 마찬가지로 `CONCURRENTLY` 옵션을 사용해서 온라인 방식으로 수행할 수도 있다.

```sql
$ reindex table {concurrently} <table_name>
$ reindex index {concurrently} <index_name>
```

`CONCURRENTLY` 옵션을 사용할 때 발생할 수 있는 문제점은 CIC 옵션과 유사하다.

다만 인덱스 리빌드 작업 시 사용하는 `CONCURRENTLY` 옵션은 내부적으로 `_ccnew` 라는 임시 인덱스를 생성한다는 차이가 있다.

기존 인덱스는 그대로 유지한 채 별도의 작업용 인덱스를 생성해서 리빌드 작업을 진행하고, 완료후에는 이 작업용 인덱스를 기존 인덱스와 교체하는 방식으로 동작한다.

만약 온라인 리빌드 작업이 비정상적으로 종료되면, `_ccnew` 인덱스는 INVALID 상태로 남게 된다. 이 경우에는 해당 인덱스를 삭제한 후 리빌드 작업을 다시 수행해야 한다.

```sql
$ reindex index CONCURRENTLY svc.example_n1;
```

위 인덱스를 생성하고 다음 명령어로 확인해보라.

```sh
$ \d svc.example_n1
```

내부적으로 생성된 `_ccnew` 인덱스를 확인해보고 리빌드 작업이 완료되면 삭제되는 것을 볼 수 있다.

# 인덱스 관리 명령어

### 인덱스 이름 변경하기

인덱스 이름을 변경하는 명령어는 다음과 같다. RENAME TO 뒤의 인덱스 명에는 스키마명을 입력하지 않는다.

```sql
$ alter index svc.example1_n1 rename to t1_index1;
```

### 인덱스 구성 컬럼 변경 후 중복 인덱스 DROP 시 주의 사항

성능 튜닝을 진행하다 보면 기존 인덱스에 컬럼을 추가하는 경우가 자주 발생한다. 이는 개발 초기에는 단일 컬럼 인덱스로도 성능 문제가 없지만 데이터 볼륨이 증가하면 단일 컬럼 인덱스보다는 결합 인덱스가 성능 측면에서 더 유리하기 때문이다. 아래 예제는 기존 단일 컬럼 인덱스에 컬럼을 추가해서 새로운 인덱스를 생성한 경우이다. 기존 인덱스는 중복 인덱스로 분류되며 DROP 대상이다.

```sql
$ create index example_n1_new on svc.example1 (col1, col2);

$ \d svc.example1
```

운영 환경에서 인덱스를 DROP 할 때는 반드시 `CONCURRENTLY` 옵션을 사용해야 한다. 기존 인덱스를 참조 중인 쿼리가 수행되고 있는 경우,

인덱스 DROP 명령을 수행한 세션은 락을 대기한다. 따라서 아래와 같이 DROP 작업을 수행한 후에 인덱스명을 변경한다.

```sql
$ drop index concurrently svc.example1_n1;

$ alter index svc.example1_n1_new rename to example1_n1;
```

### EXPLAIN 키워드를 활용해 쿼리 옵티마이저의 실행 계획 분석해보기
