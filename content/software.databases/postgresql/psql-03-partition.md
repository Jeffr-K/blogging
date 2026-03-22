---
title: PostgreSQL Partitioning
date: 2026-02-19
tags: [postgresql, partitioning]
---

# Introduction to PostgreSQL Partition

파티션은 대용량 테이블을 효율적으로 관리하기 위한 필수적인 기능이다. PostgreSQL 9.6 버전까지는 파티션을 구축하는 방식이 매우 복잡했다.

부모 테이블을 생성한 후 상속을 통해 자식 테이블을 생성하고 파티션 프루닝을 위해 트리거를 직접 구현해야 하는 등의 번거로운 작업이 필요했다.

### PostgreSQL 9.6 이전 방식: 상속 + 트리거 기반 파티셔닝

```sql
-- =============================================
-- PostgreSQL 9.6 이전 방식: 상속 + 트리거 기반 파티셔닝
-- =============================================

-- 1. 부모 테이블 생성
CREATE TABLE orders (
    id          BIGSERIAL,
    order_date  DATE        NOT NULL,
    customer_id BIGINT      NOT NULL,
    amount      NUMERIC(12, 2),
    PRIMARY KEY (id, order_date)
);

-- 2. 자식 테이블 생성 (상속 + CHECK 제약조건으로 범위 지정)
CREATE TABLE orders_2023 (
    CHECK (order_date >= DATE '2023-01-01' AND order_date < DATE '2024-01-01')
) INHERITS (orders);

CREATE TABLE orders_2024 (
    CHECK (order_date >= DATE '2024-01-01' AND order_date < DATE '2025-01-01')
) INHERITS (orders);

CREATE TABLE orders_2025 (
    CHECK (order_date >= DATE '2025-01-01' AND order_date < DATE '2026-01-01')
) INHERITS (orders);

-- 3. 자식 테이블에 인덱스 생성 (부모 테이블 인덱스는 상속되지 않음)
CREATE INDEX idx_orders_2023_date ON orders_2023 (order_date);
CREATE INDEX idx_orders_2024_date ON orders_2024 (order_date);
CREATE INDEX idx_orders_2025_date ON orders_2025 (order_date);

-- 4. 파티션 라우팅 트리거 함수 생성
--    INSERT 시 order_date 값에 따라 적절한 자식 테이블로 데이터를 라우팅한다.
CREATE OR REPLACE FUNCTION orders_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.order_date >= DATE '2023-01-01' AND NEW.order_date < DATE '2024-01-01') THEN
        INSERT INTO orders_2023 VALUES (NEW.*);
    ELSIF (NEW.order_date >= DATE '2024-01-01' AND NEW.order_date < DATE '2025-01-01') THEN
        INSERT INTO orders_2024 VALUES (NEW.*);
    ELSIF (NEW.order_date >= DATE '2025-01-01' AND NEW.order_date < DATE '2026-01-01') THEN
        INSERT INTO orders_2025 VALUES (NEW.*);
    ELSE
        RAISE EXCEPTION 'order_date out of range: %', NEW.order_date;
    END IF;

    -- 부모 테이블에는 실제 데이터를 저장하지 않으므로 NULL 반환
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. 부모 테이블에 BEFORE INSERT 트리거 등록
CREATE TRIGGER orders_insert_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION orders_insert_trigger();

-- =============================================
-- 사용 예시
-- =============================================

-- INSERT: 트리거에 의해 자동으로 자식 테이블로 라우팅됨
INSERT INTO orders (order_date, customer_id, amount) VALUES ('2023-06-15', 101, 5000.00);
INSERT INTO orders (order_date, customer_id, amount) VALUES ('2024-11-20', 202, 12000.00);
INSERT INTO orders (order_date, customer_id, amount) VALUES ('2025-03-05', 303, 8500.00);

-- SELECT: 부모 테이블 조회 시 모든 자식 테이블 데이터가 함께 조회됨
--         constraint_exclusion 설정이 on 이어야 파티션 프루닝이 동작한다.
SET constraint_exclusion = on;

SELECT * FROM orders WHERE order_date = '2024-11-20';

-- 특정 자식 테이블만 직접 조회
SELECT * FROM orders_2024 WHERE customer_id = 202;

-- ONLY 키워드로 부모 테이블 단독 조회 (자식 테이블 제외)
SELECT * FROM ONLY orders;
```

### 이전 방식의 문제점 및 한계

- 새로운 연도가 추가될 때마다 자식 테이블, 인덱스, 트리거 함수를 수동으로 수정해야 한다.
- UPDATE 시 order_date가 변경되면 자식 테이블 간 이동이 자동으로 처리되지 않는다.
- constraint_exclusion 설정에 의존하므로 설정이 off 이면 전체 테이블을 스캔한다.
- 트리거 오버헤드로 인해 대량 INSERT 성능이 저하될 수 있다.

### PostgreSQL 파티션의 특징

PostgreSQL 은 버전 10부터 선언적 파티션 생성 문법을 지원하지만 내부적으로는 기존 방식과 동일하게 부모 테이블을 생성한 후 그 구조를 상속해서 자식 테이블을 생성한다.

따라서 물리적인 관점에서 보면 부모 테이블과 자식 테이블은 서로 별개의 테이블이다.

반면 오라클은, 하나의 테이블 안에 여러 개의 파티션이 존재하는 구조이다. 다시 말하면 여러 개의 파티션을 합쳐 하나의 테이블로 구성하며 이때 파티션은 LOCAL, 테이블은 GLOBAL 레벨로 분리한다.

### 파티션 유형

PostgreSQL 에서 제공하는 파티션 유형은 세 가지이다.

- RANGE 파티션
- LIST 파티션
- HASH 파티션

이러한 파티션 유형들을 조합하여 서브 파티션을 구성할 수도 있다. 예를 들어, `RANGE+LIST`, `LIST+RANGE`, `RANGE+HASH` 형태의 서브 파티션 생성이 가능하다.

다만 실무에서는 서브 파티션까지 적용하는 경우가 매우 드물다.

### Range 파티션

`RANGE` 파티션은 이력 테이블을 효율적으로 관리하는 데 큰 장점을 제공한다. 하나의 테이블에 모든 이력 데이터를 저장하면 필연적으로관리 이슈가 발생하게 된다.

예를 들어, 보관 기간이 지난 데이터를 DELETE 명령어로 삭제할 경우 대량의 WAL 파일(트랜잭션 로그)이 발생해 I/O 부하가 증가하며 테이블 단위 백업이나 VACCUM 명령어 수행시에도 많은 시간이 소요된다.

하지만 RANGE 파티션을 적용하면 파티션 단위로 작업할 수 있기 때문에 관리 효율이 크게 향상된다. 특히 보관 기간이 지난 데이터를 삭제할 때에는 해당 파티션을 DROP 하면 된다.

##### 예제

```sql
$ create table svc.t1_r (
    c1      integer     not null
    log_date varchar(8) not null
    dummy varchar(10)
  ) partition by range(log_date);
```

그리고 나서 확인을 해보자:

```sh
$ \d svc.t1_r
```

명령을 수행하면 해당 테이블이 파티션 테이블로 생성된 것을 확인할 수 있다. 이 시점에는 아직 자식 테이블이 존재하지 않기 때문에 파티션 개수는 0개이다.

`RANGE` 파티션의 자식 테이블은 `FROM`, `TO` 구문을 이용해서 범위를 지정한다. `FROM` 에는 시작 값을 입력하고, `TO` 에는 다음 파티션의 시작 값을 지정한다. 이때 `TO` 에 지정된 값은 해당 파티션에 포함되지 않는다는 점에 유의한다.

파티션 테이블은 생성할 때부터 고려할 수도 있지만 기존 테이블이 점차 커지면서 파티션 구조로 전환하는 경우도 있다. 이 경우 `FROM` 에는 `MINVALUE` 를 지정해서, 아주 오래전 데이터들을 하나의 자식 테이블로 묶는 방식을 사용하기도 한다.

```sql
$ create table svc.t1_r_202201 partition of svc.t1_r for values from ('20220101') to ('20220201');
$ create table svc.t1_r_202202 partition of svc.t1_r for values from ('20220201') to ('20220301');
$ create table svc.t1_r_202203 partition of svc.t1_r for values from ('20220301') to ('20220401');
$ create table svc.t1_r_202204 partition of svc.t1_r for values from ('20220401') to ('20220501');
$ create table svc.t1_r_202205 partition of svc.t1_r for values from ('20220501') to ('20220601');
$ create table svc.t1_r_202206 partition of svc.t1_r for values from ('20220601') to ('20220701');
$ create table svc.t1_r_202207 partition of svc.t1_r for values from ('20220701') to ('20220801');
```

> ![info] `TO` 에는 `MAXVALUE` 를 지정할 수 있다. 단, RANGE 파티션은 매년 다음 해의 자식 테이블을 미리 생성해두기 때문에 `MAXVALUE` 는 거의 사용되지 않는다.

생성된 파티션 정보는 `\d+` 메타 명령어를 통해 확인할 수 있다.

```sh
$ \d+ svc.t1_r
```









### LIST 파티션

리스트 파티션은 코드 값을 기준으로 테이블을 분할하는 방식이다. 예를 들어 국가별, 지점별 등 대분류 항목에 따라 테이블을 나누고자 할 때 사용할 수 있다.

##### 예제

리스트 파티션은 IN 절을 이용해서 각 자식 테이블에 입력될 코드 값을 명시적으로 지정한다.

간혹 새로운 코드 값이 반영되지 않아 오류가 발생할 수 있으므로, `DEFAULT` 파티션을 함께 생성하는 것이 좋다.

```sql
$ create table svc.t1_l (
    c1           integer       not null,
    divcode      varchar(8)    not null,
    dummy        varchar(10)
) partition by list (divcode);

$ create table svc.t1_l_1 partition of svc.t1_l for values in ('A', 'B');
$ create table svc.t1_l_2 partition of svc.t1_l for values in ('C');
$ create table svc.t1_l_default partition of svc.t1_l default;
```

리스트 파티션에 명시되지 않은 코드 값은 DEFAULT 파티션에 자동으로 입력된다.

```sql
$ insert into svc.t1_1_values(1, 'D', 'dummy');

$ select * from svc.t1_1_pd;
```

만약 DEFAULT 파티션에 입력된 값으로 새로운 자식 테이블을 생성하려고 시도하면, 아래와 같은 오류가 발생한다.

```sql
create table svc.t1_l_p3 partition of svc.t1_l for values in ('D');
```

```shell
ERROR: updated partition constraint for default partition "t1_l_pd" would be violated by some row
```

오라클의 경우에는 파티션을 분할하는 스플릿 기능을 이용해서 이 문제를 해결할 수 있지만, PostgreSQL 은 아직 해당 기능을 지원하지 않는다.

따라서 다음의 절차를 수행해야 한다:

- DEFAULT 파티션에서 스플릿 대상 데이터 추출
- DEFAULT 파티션에서 스플릿 대상 데이터 삭제
- 신규 자식 테이블 생성
- 추출한 데이터를 신규 자식 테이블에 입력

> PostgreSQL 의 신기능, 변경사항, 위시 리스트를 제공하는 사이트인 [https://www.depesz.com/](https://www.depesz.com/) 에 따르면 버전 17 에서는 파티션 SPLIT, MERGE 기능이 도입될 예정이었던 것으로 보인다.

### HASH 파티션

동시에 대량의 입력 작업이 발생하면 핫 블록 발생으로 인한 병목 현상이 발생할 수 있다. 이러한 병목 현상을 개선하려면, 입력 위치를 분산시키는 것이 효과적이다.

이때 활용할 수 있는 방법이 해시 파티션이다.

##### 예제

우선 테이블을 구성한다. 해시 파티션은 지정된 컬럼에 대해 나머지 연산(mod 연산)을 수행한 결과를 기준으로 데이터를 각 자식 테이블에 분산한다.

```sql
$ create table svc.t1_h (
    c1      integer     not null,
    seqno   integer     not null,
    dummy   varchar(10)
  ) partition by hash (seqno);

$ create table svc.t1_h_p1 partition of svc.t1_h for values with (modulus 4, remainder 0);
$ create table svc.t1_h_p2 partition of svc.t1_h for values with (modulus 4, remainder 1);
$ create table svc.t1_h_p3 partition of svc.t1_h for values with (modulus 4, remainder 2);
$ create table svc.t1_h_p4 partition of svc.t1_h for values with (modulus 4, remainder 3);
```

### 파티션 인덱스

PostgreSQL 에서는 두 가지 방식으로 파티션 인덱스를 생성할 수 있다.

- 자동 인덱스 생성 방식
- 수동 인덱스 생성 방식

##### 자동 인덱스 생성 방식

자동 인덱스 생성 방식은 버전 11부터 제공되는 기능인데, 부모 테이블에 인덱스를 생성하면 자식 테이블에도 동일한 인덱스가 자동으로 생성되는 방식이다.

이전 버전에서는 자식 테이블을 추가할 때마다 인덱스를 수동으로 생성해야 했기 떄문에 관리에 번거로움이 있었다. 자동 인덱스 생성 기능은 이러한 불편함을 해소해주는 매우 유용한 기능이다.

##### 예제

자동 인덱스 생성 방식 테스트를 위해 RANGE 파티션의 부모 테이블에 기본 키(PK) 와 일반 인덱스를 생성한다.

```sql
$ alter table svc.t1_r add constraint t1_r_pk primary key (c1, log_date);

$ create index t1_r_n1 on svc.t1_r (log_date);
```

참고로 PK 를 생성할 때는 반드시 파티션 컬럼을 포함해야 한다. 파티션 컬럼을 포함하지 않으면 다음과 같은 에러가 발생한다:

```sql
$ alter table svc.t1_r add constraint t1_r_pk primary key (c1); -- log_date 가 빠짐!
```

```sh
ERROR: unique constraint on partitioned table must include all partition key columns
(DETAIL): PRIMARY KEY constraint on table "t1_r" lacks column "log_date" which is part of the partition key.
```

자동 인덱스 생성 방식은 부모 테이블 레벨에서 인덱스를 관리하기 때문에, 부모 테이블에 \d 메타 명령어를 수행하면 전체 인덱스 목록을 확인할 수 있다.

```sh
$ \d svc.t1_r
```

부모 테이블에 인덱스가 생성된 후에 각 자식 테이블에도 동일한 인덱스가 자동으로 생성된 것을 확인할 수 있다. 이때 기본 키 인덱스의 이름은 `pkey` 로 일반 인덱스의 이름은 `<column_name>_idx` 로 생성된다.

```sh
$ \d svc.t1_r_p2025;
```

이후에 생성되는 모든 자식 테이블에는 부모 테이블의 인덱스가 자동으로 생성된다.

### 수동 인덱스 생성 방식

수동 인덱스 생성 방식은 자식 테이블마다 개별적으로 인덱스를 생성하는 방식으로, 이전 버전부터 제공된 방식이다.

이 방식은 자동 인덱스 생성 기능이 추가된 이후로는 거의 사용되지 않지만, 특정 상황에서는 여전히 유용하게 활용될 수 있다.

예를 들어, 올해 자식 테이블만 조회가 발생한다고 가정해보자. 이 경우 과거의 자식 테이블에는 인덱스가 필요하지 않으므로 해당 파티션에는 인덱스를 삭제해도 된다. 이처럼 특정 파티션에만 선별적으로 인덱스가 필요한 경우에는 수동 인덱스 생성 방식을 고려할 필요가 있다.

(자동 방식으로 생성된 인덱스는 자식 테이블 단위로 DROP 할 수 없다.) -- > 왜?

##### 예제

이전에 생성한 인덱스를 제거한 후, 특정 자식 테이블에만 인덱스를 생성해보자.

```sql
$ drop index svc.t1_r_n1;

$ create index t1_r_p2025_n1 on svc.t1_r_p2025 (log_date);
```

수동 인덱스 생성 방식으로 생성한 인덱스는 자식 테이블 레벨에서 관리되므로 부모 테이블에 `\d` 메타 명령어를 수행하더라도 인덱스 목록을 확인할 수 없다.

```sh
$ \d svc.t1_r
```

자식 테이블에 수동으로 생성한 인덱스 목록을 확인하려면, 해당 테이블에 직접 \d 메타 명령어를 수행해야 한다.

```sh
$ \d svc.t1_r_p2025
```

### 인덱스 ONLY 옵션

pg_indexes 뷰를 이용해서 t1_r 테이블에 생성된 인덱스 생성 스크립트를 확인해보자. 이전에 작성한 인덱스 생성 스크립트와는 달리 ONLY 옵션이 추가된 것을 확인할 수 있다.

```sql
select indexname, indexdef from pg_indexes where tablename='t1_r';
```

##### 인덱스 ONLY 옵션의 특징

파티션 테이블에 인덱스를 생성할 때 ONLY 옵션을 지정하면, 부모 테이블에만 INVALID 상태의 인덱스가 생성된다. 즉 자식 테이블에는 인덱스가 생성되지 않는다. 이러한 이유로 ONLY 옵션으로 생성된 인덱스는 실제로 사용할 수 없다.

ONLY 옵션으로 생성한 t1_r_n1 인덱스는 INVALID 상태이며 자식 테이블에는 해당 인덱스가 생성되지 않은 것을 확인할 수 있다.

```sql
$ drop index svc.t1_r_n1;

$ create index t1_r_n1 on only svc.t1_r (log_date);
```

```sh
$ \d svc.t1_r

$ \d svc.t1_r_p2025
```

##### 인덱스 ONLY 옵션의 필요성

그렇다면 왜 이 옵션을 제공하는 걸까?

운영 중에 파티션 테이블에 인덱스를 추가한다고 가정해보자. 이 경우 시스템에 영향을 주지 않기 위해서는 CIC 옵션을 사용해서 인덱스를 생성해야 한다.

하지만 PostgreSQL 은 부모 테이블에 대해서는 CIC 옵션을 지원하지 않는다.

```sql
$ create index concurrently t1_r_n1 on svc.t1_r (log_date);
```

```sh
ERROR: cannot create index on partitioned table "t1_r" concurrently
```

이때, ONLY 옵션을 이용하면 된다. 전체적인 작업 순서는 다음과 같다:

1. ONLY 옵션을 사용해서 부모 테이블에 인덱스를 생성한다.
2. 자식 테이블 각각에 대해 CIC 옵션으로 인덱스를 생성한다.
3. 자식 테이블에 생성한 인덱스를 부모 테이블의 인덱스에 ATTACH 한다.

### 파티션 관리 명령어

DBA 가 수행하는 파티션 관리 업무는 대부분 자식 테이블 추가 및 삭제 작업이며 필요에 따라 ATTACH 또는 DETACH 작업을 수행한다.

##### 자식 테이블 추가

자식 테이블 추가는 앞서 살펴본 것과 같이 CREATE TABLE ... PARTITION OF 구문을 사용한다.

이때 부모 테이블에 자동 인덱스 생성 방식으로 생성된 인덱스가 있다면 추가된 자식 테이블에도 동일한 인덱스가 자동으로 생성된다.

```sql
create table svc.t1_r_p2026 partition of svc.t1_r for values from('20260101') to ('20270101');
```

```sh
$ \d svc.t1_r_p2026
```

##### 자식 테이블 삭제

자식 테이블 삭제는 일반 테이블과 동일하게 DROP TABLE 구문을 사용한다.

```sql
drop table svc.t1_r_p2020;
```

##### 자식 테이블 DETACH

보관 기간이 지난 자식 테이블을 삭제하지 않고, 파티션 테이블에서 분리하여 별도로 보관하는 경우도 있다. 이 경우에는 DETACH 명령어를 사용해서 해당 자식 테이블을 부모 테이블에서 분리할 수 있다.

먼저 pg_partition_tree() 함수를 이용해서 현재 파티션 구성 상태를 확인해보자.

```sql
$ select pg_partition_tree('svc.t1_r');
```

이제 자식 테이블을 분리해보자. 운영 환경이라면 CONCURRENTLY 옵션을 사용하여 동시성 문제를 해결할 수 있다.

```sql
$ alter table svc.t1_r_p2026 detach partition svc.t1_r_p2021 concurrently;

$ select pg_partition_tree('svc.t1_r');
```

> [info] DETACH CONCURRENTLY 옵션은 버전 14 부터 지원되는 기능이다. 이 옵션을 사용하면 파티션을 분리할 때도 락 경합 없이 작업을 수행할 수 있다.

##### 파티션 ATTACH

파티션 ATTACH 기능을 이용하면 일반 테이블을 자식 테이블로 빠르게 전환할 수 있다.

예를 들어 로그 테이블의 크기가 점차 커짐에 따라 연 단위 RANGE 파티션으로 전환할 필요가 있고, 현재까지 입력된 로그 데이터는 올해 파티션에 저장한다고 가정해보자.

만약 파티션 ATTACH 기능이 없다면, 파티션 테이블을 생성한 후 기존 로그 데이터를 해당 파티션 테이블에 입력해야 한다. 하지만 로그 데이터가 많을수록 이 전환 작업은 많은 시간과 자원을 소모하게 된다.

반면 파티션 ATTACH 기능을 사용하면 기존 테이블을 즉시 자식 테이블로 전환할 수 있기 때문에 훨씬 빠르게 작업을 마칠 수 있다.

- 자동 인덱스 생성 기능이 적용된다. 파티션 ATTACH 도 자식 테이블을 추가하는 작업이므로 부모 테이블에 존재하는 인덱스가 자식 테이블에 자동으로 적용된다. 단 자식 테이블에 이미 동일한 인덱스가 생성되어 있다면 이 단계는 건너뛴다.
- 자식 테이블에 대한 체크 제약 조건을 검사한다. 해당 테이블이 이미 체크 제약 조건을 가지고 있다면 이 단계는 건너뛴다. 이는 자식 테이블이 파티션 범위 조건을 충족하는지를 확인하는 과정이다.

따라서 파티션 ATTACH 작업을 최대한 빠르게 수행하려면 다음 두 가지를 사전에 준비해두는 것이 좋다:

1. 부모 테이블에 존재하는 인덱스를 자식 테이블에 미리 생성한다.
2. 자식 테이블에 파티션 범위에 맞는 체크 제약 조건을 미리 생성한다.

이렇게 준비해두면 파티션 ATTACH 시 인덱스 생성이나 제약 조건 확인 작업이 생략되어 매우 빠르게 파티션 전환을 할 수 있다. 아래 예제를 통해 실제 적용 방법을 살펴보자.

테스트를 위해 대용량 로그 테이블과 인덱스를 미리 생성한다.

```sql
$ create table svc.t_log (
    c1          integer         not null,
    log_date    varchar(8)      not null,
    dummy       varchar(10)
);

$ alter table svc.t_log add constraint t_log_pk primary key (c1, log_date);

$ create index t_log_n1 on svc.t_log (log_date);

$ insert into svc.t_log
    select c1, c2, 'dummy'
    from (
            select row_number() over () as c1, to_char(c2, 'YYYYMMDD') c2
            from (
                    select c2, generate_series(1,1000) as per_day
                    from generate_series(
                                          '2020-01-01'::DATE,
                                          '2025-03-23'::DATE, '1 day'
                         ) as c2
                    ) as t
    ) as t
```

> 테스트 데이터 생성을 위해 자주 사용되는 generate_series() 함수는 지정된 범위의 숫자 또는 날짜 값을 자동으로 생성해주는 함수이다. 이를 활용하면 대량의 데이터를 쉽게 생성할 수 있다.

t_log 테이블을 파티션 테이블로 전환하기 위해 파티션 테이블을 생성한다.

```sql
$ create table svc.t_log (
    c1          integer         not null,
    log_date    varchar(8)      not null,
    dummy       varchar(10)
) partition by range (log_date);
```

파티션 테이블에 t_log 테이블과 동일한 인덱스를 생성한다. 이렇게 하면 파티션 ATTACH 작업 시에 인덱스 생성 단계는 자동으로 건너뛰게 된다.

```sql
$ alter table svc.t_log_r add constraint t_log_r_pk primary key (c1,log_date);

$ create index t_log_r_n1 on svc.t_log_r (log_date);
```

또한 파티션 범위에 해당하는 CHECK 제약 조건을 기존 테이블에 미리 생성한다. 이렇게 하면 파티션 ATTACH 작업 시에 기존 데이터가 지정된 파티션 범위에 포함되는지 여부를 확인하는 작업을 건너 뛴다.

```sql
$ alter table svc.t_log add constraint t_log_chk1 check (log_date < '20260101');
```

이제 모든 사전 준비가 완료되었으므로, 파티션 ATTACH 작업을 수행한다. 작업 시간을 확인하기 위해 `timing` 옵션을 활성화한 후 실행하면 파티션 전환이 매우 빠르게 처리된 것을 볼 수 있다.

```sh
\timing
```

```sql
alter table svc.t_log_r attach partition svc.t_log for values from (MINVALUE) to ('20260101');
```

ATTACH 작업이 완료된 후에는 기존에 생성한 CHECK 제약 조건은 더 이상 필요하지 않으므로 삭제한다. 또한 자식 테이블 명을 적절히 변경한다.

```sql
$ alter table svc.t_log drop constraint t_log_chk1;

$ alter table svc.t_log rename to t_log_r_p2025;
```
