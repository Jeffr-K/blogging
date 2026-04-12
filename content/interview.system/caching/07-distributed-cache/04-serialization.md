---
title: "직렬화: 캐시 값 저장 형식"
date: 2026-04-12
tags: [cache, serialization, json, msgpack, protobuf]
---

## 직렬화가 중요한 이유

Redis는 바이트 배열을 저장합니다. Python 객체나 Java 객체를 그대로 저장할 수 없습니다.

```
Python dict → bytes → Redis 저장
Redis → bytes → Python dict
```

직렬화 방식에 따라:
- **속도**: 10배 차이 가능
- **크기**: JSON vs MessagePack vs Protobuf

---

## 방법 1: JSON (가장 보편적)

```python
import json

def cache_get_json(redis_client, key: str) -> dict | None:
    val = redis_client.get(key)
    return json.loads(val) if val else None

def cache_set_json(redis_client, key: str, data: dict, ttl: int):
    redis_client.setex(key, ttl, json.dumps(data, ensure_ascii=False))


# 사용
data = {"id": 42, "name": "Alice", "tags": ["admin", "user"]}
cache_set_json(redis, "user:42", data, 3600)
result = cache_get_json(redis, "user:42")
```

**장점:** 사람이 읽을 수 있음, 범용적  
**단점:** 타입 정보 없음 (datetime → string 변환 필요), 크기 큼

```python
# datetime 처리
from datetime import datetime

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

json.dumps(data, cls=DateTimeEncoder)
```

---

## 방법 2: MessagePack (바이너리, 빠르고 작음)

```bash
pip install msgpack
```

```python
import msgpack

def cache_get_msgpack(redis_client, key: str):
    val = redis_client.get(key)
    return msgpack.unpackb(val, raw=False) if val else None

def cache_set_msgpack(redis_client, key: str, data, ttl: int):
    redis_client.setex(key, ttl, msgpack.packb(data, use_bin_type=True))
```

**JSON vs MessagePack 비교:**

```
데이터: {"id": 42, "name": "Alice", "scores": [100, 95, 88]}

JSON:       53 bytes  (사람 읽기 가능)
MessagePack: 32 bytes  (40% 절약)

직렬화 속도: MessagePack이 2~3배 빠름
역직렬화 속도: MessagePack이 2~3배 빠름
```

---

## 방법 3: Protobuf (스키마 기반, 가장 효율적)

```bash
pip install protobuf
```

```protobuf
// user.proto
syntax = "proto3";

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
  repeated string tags = 4;
}
```

```python
from user_pb2 import User

def cache_get_proto(redis_client, key: str) -> User | None:
    val = redis_client.get(key)
    if not val:
        return None
    user = User()
    user.ParseFromString(val)
    return user

def cache_set_proto(redis_client, key: str, user: User, ttl: int):
    redis_client.setex(key, ttl, user.SerializeToString())
```

**단점:** 스키마 파일 관리, 서비스 간 proto 파일 공유 필요

---

## 방법 4: Python pickle (Python 전용)

```python
import pickle

redis_client.set("key", pickle.dumps(obj))
result = pickle.loads(redis_client.get("key"))
```

**경고:** pickle은 임의 코드 실행 취약점이 있습니다. **신뢰할 수 없는 데이터에 절대 사용 금지.**  
Python 내부 서비스에서만, 외부 입력 데이터는 절대 안 됩니다.

---

## Java: Spring의 직렬화 설정

```java
@Configuration
public class RedisConfig {

    // JSON 직렬화 (기본 설정)
    @Bean
    public RedisTemplate<String, Object> redisTemplate(
        RedisConnectionFactory factory
    ) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        Jackson2JsonRedisSerializer<Object> serializer =
            new Jackson2JsonRedisSerializer<>(Object.class);

        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(serializer);
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(serializer);

        return template;
    }
}
```

---

## 직렬화 방식 비교

| 방식 | 크기 | 속도 | 가독성 | 타입 안전 | 권장 상황 |
|------|------|------|--------|----------|----------|
| JSON | 중간 | 중간 | ✅ | ❌ | 일반적인 경우 |
| MessagePack | 작음 | 빠름 | ❌ | ❌ | 성능 중요 |
| Protobuf | 가장 작음 | 가장 빠름 | ❌ | ✅ | 서비스 간 통신 |
| pickle | 중간 | 빠름 | ❌ | ✅ | Python 내부만 |

---

## 실전 선택

```
내부 서비스, 빠른 개발: JSON
성능이 중요한 대용량: MessagePack
여러 언어 간 공유: Protobuf
Python 전용 내부: pickle (보안 주의)
```

---

## 핵심 요약

- Redis는 바이트 배열 저장 → 직렬화 필수
- **JSON**: 보편적, 사람이 읽기 가능, 크기/속도 중간
- **MessagePack**: 바이너리, 40% 작고 2~3배 빠름
- **Protobuf**: 스키마 기반, 가장 효율적, 언어 독립적
- pickle: Python 전용, 신뢰할 수 없는 데이터에 절대 금지
