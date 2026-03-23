---
title: "[Redis] 33. RedisJSON & RediSearch — JSON 문서와 전문 검색"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "RedisJSON", "RediSearch", "full-text-search", "JSON"]
---

# RedisJSON & RediSearch — JSON 문서와 전문 검색

Redis Stack 모듈. JSON 문서 저장 + 인덱싱 + 전문 검색.

## 설치

```bash
# Redis Stack (모듈 포함)
docker run -d --name redis-stack \
  -p 6379:6379 -p 8001:8001 \
  redis/redis-stack:latest

# Redis Stack Server (UI 없음)
docker run -d --name redis-stack-server \
  -p 6379:6379 \
  redis/redis-stack-server:latest
```

---

## RedisJSON — JSON 문서 저장

### CLI 기본 사용

```bash
# JSON 저장
JSON.SET user:1001 $ '{"id":1001,"name":"Alice","age":30,"email":"alice@example.com","tags":["admin","user"]}'

# 전체 조회
JSON.GET user:1001

# 특정 경로 조회 (JSONPath)
JSON.GET user:1001 $.name
JSON.GET user:1001 $.tags[0]

# 필드 업데이트
JSON.SET user:1001 $.age 31
JSON.SET user:1001 $.address '{"city":"Seoul","zip":"04512"}'

# 필드 삭제
JSON.DEL user:1001 $.address

# 숫자 증가
JSON.NUMINCRBY user:1001 $.age 1

# 배열 조작
JSON.ARRAPPEND user:1001 $.tags '"moderator"'
JSON.ARRLEN user:1001 $.tags
JSON.ARRPOP user:1001 $.tags

# 타입 조회
JSON.TYPE user:1001 $.age       # integer
JSON.TYPE user:1001 $.tags      # array
```

### Spring Data Redis + JSON

```kotlin
// 의존성
// implementation("com.redis:redis-om-spring:0.9.0")
// 또는 직접 RedisTemplate + JSON 직렬화

@Service
class UserJsonService(private val redis: StringRedisTemplate) {

    private val objectMapper = ObjectMapper()

    fun save(user: User) {
        val json = objectMapper.writeValueAsString(user)
        redis.execute { connection ->
            connection.execute(
                "JSON.SET",
                "user:${user.id}".toByteArray(),
                "$".toByteArray(),
                json.toByteArray()
            )
        }
    }

    fun get(userId: Long): User? {
        val result = redis.execute { connection ->
            connection.execute(
                "JSON.GET",
                "user:$userId".toByteArray(),
            )
        } as? ByteArray ?: return null

        return objectMapper.readValue(result, User::class.java)
    }

    fun getField(userId: Long, path: String): Any? {
        return redis.execute { connection ->
            connection.execute(
                "JSON.GET",
                "user:$userId".toByteArray(),
                path.toByteArray(),
            )
        }
    }
}
```

---

## RediSearch — 인덱싱 & 검색

### 인덱스 생성

```bash
# 사용자 인덱스 생성
FT.CREATE idx:users
  ON JSON
  PREFIX 1 user:
  SCHEMA
    $.name AS name TEXT WEIGHT 5.0
    $.email AS email TAG
    $.age AS age NUMERIC SORTABLE
    $.tags[*] AS tags TAG
    $.address.city AS city TEXT

# 필드 타입
# TEXT: 전문 검색 (형태소 분석)
# TAG: 정확한 값 검색 (이메일, 카테고리)
# NUMERIC: 범위 검색
# GEO: 위치 기반 검색
# VECTOR: 벡터 유사도 검색 (7.2+)
```

### 검색

```bash
# 전문 검색
FT.SEARCH idx:users "Alice"

# 특정 필드 검색
FT.SEARCH idx:users "@name:Alice"

# TAG 검색 (정확 일치)
FT.SEARCH idx:users "@email:{alice@example.com}"
FT.SEARCH idx:users "@tags:{admin}"

# 복합 검색
FT.SEARCH idx:users "@name:Alice @age:[25 35]"

# 범위 검색
FT.SEARCH idx:users "@age:[20 30]"

# 정렬
FT.SEARCH idx:users "*" SORTBY age ASC

# 페이지네이션
FT.SEARCH idx:users "*" LIMIT 0 10    # 처음 10개
FT.SEARCH idx:users "*" LIMIT 10 10   # 다음 10개

# 반환 필드 지정
FT.SEARCH idx:users "Alice" RETURN 2 name email

# 집계
FT.AGGREGATE idx:users "*"
  GROUPBY 1 @city
  REDUCE COUNT 0 AS count
  SORTBY 2 @count DESC

# 자동완성 (Suggest)
FT.SUGADD autocomplete:users "Alice Johnson" 1.0
FT.SUGGET autocomplete:users "Ali" FUZZY
```

### Spring 통합

```kotlin
@Service
class UserSearchService(private val redis: StringRedisTemplate) {

    fun createIndex() {
        redis.execute { connection ->
            connection.execute(
                "FT.CREATE",
                "idx:users".toByteArray(),
                "ON".toByteArray(),
                "JSON".toByteArray(),
                "PREFIX".toByteArray(),
                "1".toByteArray(),
                "user:".toByteArray(),
                "SCHEMA".toByteArray(),
                "$.name".toByteArray(), "AS".toByteArray(), "name".toByteArray(), "TEXT".toByteArray(),
                "$.email".toByteArray(), "AS".toByteArray(), "email".toByteArray(), "TAG".toByteArray(),
                "$.age".toByteArray(), "AS".toByteArray(), "age".toByteArray(), "NUMERIC".toByteArray(), "SORTABLE".toByteArray(),
            )
        }
    }

    fun search(query: String, page: Int = 0, pageSize: Int = 10): SearchResult {
        val offset = page * pageSize
        val result = redis.execute { connection ->
            connection.execute(
                "FT.SEARCH",
                "idx:users".toByteArray(),
                query.toByteArray(),
                "LIMIT".toByteArray(),
                offset.toString().toByteArray(),
                pageSize.toString().toByteArray(),
            )
        }
        return parseSearchResult(result)
    }

    fun searchByAge(minAge: Int, maxAge: Int): SearchResult {
        return search("@age:[$minAge $maxAge]")
    }

    fun searchByTag(tag: String): SearchResult {
        return search("@tags:{$tag}")
    }

    fun fullTextSearch(text: String): SearchResult {
        return search("@name:$text")
    }
}
```

---

## Vector Search (시맨틱 검색)

```bash
# 벡터 인덱스 생성 (HNSW 알고리즘)
FT.CREATE idx:products
  ON JSON
  PREFIX 1 product:
  SCHEMA
    $.name AS name TEXT
    $.embedding AS embedding VECTOR HNSW 6
      TYPE FLOAT32
      DIM 1536           # OpenAI embedding 차원
      DISTANCE_METRIC COSINE

# 벡터 저장
JSON.SET product:1 $ '{"name":"Redis Guide","embedding":[0.1,0.2,...]}'

# KNN 벡터 검색 (가장 유사한 10개)
FT.SEARCH idx:products
  "*=>[KNN 10 @embedding $query_vec]"
  PARAMS 2 query_vec <binary-vector>
  RETURN 2 name __vector_score
  DIALECT 2
```

---

## 인덱스 관리

```bash
# 인덱스 정보 조회
FT.INFO idx:users

# 인덱스 목록
FT._LIST

# 인덱스 삭제 (데이터 유지)
FT.DROPINDEX idx:users

# 인덱스 삭제 (데이터도 삭제)
FT.DROPINDEX idx:users DD

# 인덱스 변경 (새 필드 추가)
FT.ALTER idx:users SCHEMA ADD $.city AS city TEXT
```

---

## 정리

### RedisJSON 주요 명령어

| 명령어 | 용도 |
|--------|------|
| `JSON.SET key path value` | JSON 저장/업데이트 |
| `JSON.GET key [path]` | JSON 조회 |
| `JSON.DEL key path` | 필드 삭제 |
| `JSON.NUMINCRBY key path n` | 숫자 증가 |
| `JSON.ARRAPPEND key path val` | 배열에 추가 |

### RediSearch 주요 명령어

| 명령어 | 용도 |
|--------|------|
| `FT.CREATE` | 인덱스 생성 |
| `FT.SEARCH` | 검색 |
| `FT.AGGREGATE` | 집계 |
| `FT.SUGADD/SUGGET` | 자동완성 |
| `FT.INFO` | 인덱스 정보 |

- **TEXT**: 형태소 분석 + TF-IDF 점수
- **TAG**: `{value}` 구문으로 정확 일치
- **NUMERIC**: `[min max]` 구문으로 범위 검색
- **VECTOR**: KNN 시맨틱 검색 (Redis Stack 전용)
