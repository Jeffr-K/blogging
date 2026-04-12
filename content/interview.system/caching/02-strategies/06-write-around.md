---
title: "Write-Around: 캐시를 건너뛰고 DB에 직접 쓴다"
date: 2026-04-12
tags: [cache, strategy, write-around]
---

## Write-Around란

쓰기 시 **캐시를 완전히 우회하고 DB에 직접 쓰는** 패턴입니다. 읽기는 Cache-Aside나 Read-Through와 결합합니다.

```
쓰기: 앱 → DB (캐시 건드리지 않음)
읽기: 앱 → 캐시 → MISS → DB → 캐시 저장
```

---

## 코드

```python
def create_log(log_data: dict):
    # 캐시 완전히 건너뜀
    db.insert("logs", log_data)
    # redis 조작 없음

def get_recent_logs(user_id: str):
    # 읽기는 캐시 활용
    cache_key = f"logs:{user_id}:recent"
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    logs = db.query("SELECT * FROM logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", user_id)
    redis.set(cache_key, json.dumps(logs), ex=60)
    return logs
```

---

## 언제 쓰나

쓰기 후 **한동안 읽히지 않을 데이터**에 적합합니다.

```
✅ 로그 데이터: 쓰고 나서 당장 조회 안 함
✅ 배치 처리 결과: 나중에 한번에 읽음
✅ 아카이브 데이터: 거의 안 읽히는 오래된 데이터

❌ 쓰고 바로 읽는 패턴 (→ Write-Through가 더 적합)
```

**왜 캐시를 건너뛰나?**

로그처럼 쓰고 읽히지 않는 데이터를 캐시에 넣으면:
- 메모리만 낭비
- 실제로 읽히는 데이터가 밀려남 (Eviction)
- 결국 히트율 하락

---

## Cache-Aside와의 차이

| | Cache-Aside | Write-Around |
|--|------------|-------------|
| 쓰기 시 캐시 | 삭제 | 무시 (건드리지 않음) |
| 다음 읽기 | MISS → DB | MISS → DB (동일) |
| 차이 | 기존 캐시를 무효화 | 처음부터 캐시 없음 |

실질적으로 "쓰기 전에 캐시가 없었다면" 두 패턴의 결과는 같습니다. Cache-Aside는 기존 캐시를 삭제하는 단계가 있고, Write-Around는 처음부터 캐시를 신경 쓰지 않습니다.

---

## 핵심 요약

- 쓰기 시 캐시 무시, 직접 DB에 씀
- 쓰고 나서 잘 읽히지 않는 데이터(로그, 아카이브)에 최적
- 캐시 오염(Cache Pollution) 방지
- 쓰고 바로 읽는 패턴에는 부적합
