---
author: ""
---

# 아키텍처

## 공유 메모리

DBMS 의 핵심 요소는 안전성과 성능이다. 트랜잭션의 안정성을 보장하면서 최대한의 성능을 제공하는 것이 핵심이다. PostgreSQL 에서는 성능을 극대화하기 위해 공유 메모리를 활용한다.

이 중 가장 중요한 구성 요소는 공유 버퍼와 WAL 버퍼이다.

### 공유 버퍼

공유 버퍼는 디스크 I/O 를 최소화함으로써 성능을 향상 시키는 것을 목적으로 한다. 이를 위해 공유 버퍼는 다음과 같은 조건을 만족하도록 설계되어야 한다.

- 큰 크기의 공유 버퍼라도 빠르게 접근할 수 있어야 한다.
- 다수의 사용자가 동시에 접근할 때에도 경합을 최소화해야 한다.
- 자주 사용되는 블록은 가능한 오랫동안 공유 버퍼에 유지되어야 한다.

### WAL 버퍼

DBMS 에서는 트랜잭션 처리의 신뢰성 보장은 필수요소다. 커밋된 트랜잭션은 반드시 데이터베이스에 반영되야 한다.

이를 보장하기 위해 Write-Ahead Logging(WAL) 방식을 사용한다.

이 방식은 트랜잭션의 내용을 데이터 파일에 기록하기 전에 WAL 파일에 먼저 기록하는 방식이다.

## 프로세스

### postgres 프로세스 (aka. postmaster process)

postgres 프로세스는 인스턴스 기동 시 가장 먼저 시작되며 다음 작업들을 수행한다:

- 인스턴스 복구 작업
- 공유 메모리 초기화
- 백그라운드 프로세스 기동
- 클라이언트 접속 시 백엔드 프로세스 생성

### 백그라운드 프로세스

PostgreSQL 은 다음과 같은 백그라운드 프로세스를 이용해서 시스템을 유지 관리한다.

프로세스명:역할
logger:운영 중에 발생하는 다양한 메세지를 로그 파일에 기록한다.
checkpointer:체크포인트 발생 시 공유 버퍼 내의 더티 버퍼를 디스크에 기록한다.
background writer:주기적으로 더티 버퍼를 디스크에 기록한다.
walwriter:WAL 버퍼의 내용을 WAL 파일에 기록한다.
autocacuum launcher:주기적으로 postgres 프로세스에게 Autovacuum 작업을 요청한다.
autovacuum: Vacuum 및 통계 정보 수집 작업을 수행한다.
archiver:아카이브 모드인 경우에 WAL 파일을 아카이브 디렉토리로 복사한다.

### 백엔드 프로세스

백엔드 프로세스는 클라이언트 프로세스의 요청을 받아 쿼리를 수행하고 결과를 반환하는 역할을 한다. 쿼리 수행을 위해 백엔드 프로세스 메모리 내에 할당되는 공간을 로컬 메모리라고 하며 이를 위한 파라미터는 다음과 같다.

파라미터 명:설명
work_mem:정렬, 비트맵, 해시 조인, Merge 조인 작업에 사용되는 메모리 공간
maintenance_work_mem:Vacuum 및 CREATE INDEX 작업에 사용되는 메모리 공간
temp_buffers:Temporary 테이블 저장용 메모리 공간

### 데이터베이스 클러스터 주요 디렉토리와 파일들

데이터베이스 클러스터 디렉토리에는 다양한 파일과 서브 디렉토리가 포함되어 있다. 주요 파일 및 디렉토리는 다음과 같다:

#### postgresql.conf

인스턴스 환경 설정용 파일이다. 파일 내에 동일한 파라미터가 존재하면 아래 부분에 위치한 파라미터의 우선 순위가 높다.

#### postgresql.auto.conf

인스턴스 환경 설정용 파일이다. ALTER SYSTEM SET 명령어로파라미터를 변경하면 해당 파일에 기록된다. 해당 파일에 기록된 파라미터는 `ALTER SYSTEM SET ... TO DEFAULT` 명령어를 실행하면 삭제된다.

동일한 파라미터가 postgresql.conf 파일과 postgresql.auto.conf 파일에 모두 존재할 경우에 postgresql.auto.conf 파일의 우선 순위가 높다.

운영 시에는 파라미터의 최종 적용 값을 확인하기 위해 두 개의 설정 파일을 모두 확인해야 하는 불편함이 있으므로 해당 파일을 이용한 파라미터 변경을 최소화하는 것이 좋다.

즉, 파라미터 변경 시에는 postgresql.conf 파일에 수작업으로 변경 내용을 적용하도록 한다.

> [!warning] 음? 삭제되면 안되지 않나?
> 이거 삭제 되면 안되지 않나

#### base 디렉토리

이 디렉토리 아래에 데이터베이스 별로 서브 디렉토리가 생성된다. 초기 생성 시점에는 1, 4, 5 서브 디렉토리가 생성된다. 각각 template1, template0, postgres 데이터베이스 용 디렉토리이다.

#### postmaster.pid

해당 파일에는 인스턴스에 대한 주요 정보들이 저장되어 있다. 버전 16부터는 postmaster 라는 프로세스 명칭을 사용하지 않지만 파일명은 여전히 postmaster.pid 를 사용한다.

이 파일은 인스턴스가 시작될 때 생성되고 종료 시 삭제된다.

```sh
$ cat postmaster.pid
```

표 3-3. postmaster.pid 주요 항목

#### postmaster.opts

이 파일은 인스턴스를 기동할 때 사용한 명령어와 옵션을 저장한다. pg_ctl restart 명령어를 실행하면 해당 파일에 기록된 옵션을 기반으로 인스턴스를 재기동한다. 아래 예시처럼 기동에 사용한 명령어가 저장되며, 이후 restart 시에 동일한 옵션이 재사용된다.

```sh
$ pg_ctl start -D /data/svc01

$ cat postmaster.opts

$ ps -ef | grep /data/svc01

$ pg_ctl restart

$ ps -ef | grep /data/svc01
```

#### current_logfiles

해당 파일에는 현재 사용 중인 로그 파일명이 저장되어 있다.

```sh
$ cat current_logfiles
```

#### pg_wal 심볼릭 링크 파일

기본적으로 pg_wal 디렉토리는 $PGDATA/pg_wal 경로에 위치한다. 이 책의 예제처럼 initdb 명령어 수행 시에 -waldir 옵션으로 별도의 디렉토리를 지정했다면 해당 디렉토리를 심볼릭 링크로 가리키게 된다.

## 테이블 스페이스

### pg_default 테이블 스페이스

### pg_global 테이블 스페이스

### 사용자 테이블 스페이스 생성

### TEMP 테이블 스페이스

## 테이블

### 테이블 (Heap Table)

### Unlogged 테이블

### Temp 테이블

## TOAST (The Oversized-Attribute Storage Technique)

### 스토리지 유형

### 컬럼 압축 여부 확인 방법

### TOAST 테이블 확인 방법

## 운영 Tip: Template 데이터베이스 기능 활용 방안

통합 테스트를 반복 수행할 때마다 동일한 초기 데이터 세트가 필요하다고 가정해보자. 일반적인 방법은 테스트 수행 전에 초기 데이터를 백업해두고 테스트가 끝난 후에 테이블을 TRUNCATE 하거나 DROP 한 뒤 백업 데이터를 복원하는 것이다.

그러나 Tempate 데이터베이스 기능을 이용하면 이러한 작업을 간단하게 처리할 수 있다.

svcdb 데이터베이스에 통합 테스트용 초기 데이터를 적재한 상태라고 가정하면 이 시점에 svcdb 를 템플릿으로 지정해서 신규 데이터베이스를 생성한다. 생성된 svcdb_tmpl 데이터베이스에는 svcdb 와 동일한 스키마 및 테이블 구조, 데이터가 그대로 복제된다.

```sql
$ create database svcdb_teml template svcdb;
```

참고로 이 작업을 수행할 때는 svcdb 데이터베이스에 접속한 세션이 없어야 한다. 접속 중인 세션이 있을 경우 다음과 같은 오류가 발생한다.

```sql

```

1차 테스트가 완료된 이후에 2차 테스트를 위한 초기 데이터가 필요한 경우에 다음과 같이 기존 데이터베이스를 삭제한 후에 템플릿 데이터베이스를 이용해서 데이터베이스를 재생성하면 된다.

```sh
$ psql -d svcdb_tmpl
```

```sql
$ drop database svcdb;

$ create database svcdb template svcdb_tmpl
```

이처럼 Template 데이터베이스 기능을 활용하면 매 테스트마다 동일한 초기 상태의 데이터베이스를 빠르게 재구축할 수 있다.
