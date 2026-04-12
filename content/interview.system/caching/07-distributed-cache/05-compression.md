---
title: "캐시 값 압축"
date: 2026-04-12
tags: [cache, compression, gzip, lz4, zstd]
---

## 언제 압축이 필요한가

```
압축이 효과 있는 경우:
  - JSON 1KB 이상 (반복 구조 많을수록 압축률 높음)
  - HTML/XML 페이지 캐싱
  - API 응답 전체를 캐싱
  - 목록 데이터 (배열)

압축이 의미 없는 경우:
  - 작은 값 (100 bytes 이하): 압축 헤더가 더 큼
  - 이미지, 동영상: 이미 압축됨
  - 숫자, 짧은 문자열
```

---

## 방법 1: gzip (표준, 압축률 높음)

```python
import gzip
import json
import redis

r = redis.Redis()

def cache_set_compressed(key: str, data: dict, ttl: int):
    json_bytes = json.dumps(data).encode("utf-8")
    compressed = gzip.compress(json_bytes)
    r.setex(key, ttl, compressed)
    return len(json_bytes), len(compressed)  # 압축 전후 크기

def cache_get_compressed(key: str) -> dict | None:
    compressed = r.get(key)
    if not compressed:
        return None
    json_bytes = gzip.decompress(compressed)
    return json.loads(json_bytes)

# 실사용
original, compressed = cache_set_compressed("feed:42", large_feed_data, 300)
print(f"압축률: {compressed/original:.1%}")  # 예: 12.3%
```

---

## 방법 2: lz4 (빠른 속도 우선)

```bash
pip install lz4
```

```python
import lz4.frame
import json

def cache_set_lz4(redis_client, key: str, data, ttl: int):
    json_bytes = json.dumps(data).encode()
    compressed = lz4.frame.compress(json_bytes)
    redis_client.setex(key, ttl, compressed)

def cache_get_lz4(redis_client, key: str):
    compressed = redis_client.get(key)
    if not compressed:
        return None
    return json.loads(lz4.frame.decompress(compressed))
```

---

## 방법 3: zstd (Facebook, 압축률+속도 균형)

```bash
pip install zstandard
```

```python
import zstandard as zstd
import json

cctx = zstd.ZstdCompressor(level=3)   # 1~22, 기본 3
dctx = zstd.ZstdDecompressor()

def cache_set_zstd(redis_client, key: str, data, ttl: int):
    json_bytes = json.dumps(data).encode()
    compressed = cctx.compress(json_bytes)
    redis_client.setex(key, ttl, compressed)

def cache_get_zstd(redis_client, key: str):
    compressed = redis_client.get(key)
    if not compressed:
        return None
    return json.loads(dctx.decompress(compressed))
```

---

## 알고리즘 비교

```
테스트 데이터: JSON 10KB (전형적인 API 응답)

알고리즘    압축 크기    압축 속도    해제 속도
gzip        2.1 KB       중간         빠름
lz4         3.5 KB       매우 빠름    매우 빠름
zstd        1.9 KB       빠름         빠름
brotli      1.7 KB       느림         빠름
```

---

## 임계값 기반 조건부 압축

작은 값은 압축하지 않습니다:

```python
COMPRESSION_THRESHOLD = 1024  # 1KB 이상만 압축
MAGIC_BYTES = b"\x1f\x8b"    # gzip 매직 바이트

def smart_set(redis_client, key: str, data, ttl: int):
    serialized = json.dumps(data).encode()

    if len(serialized) >= COMPRESSION_THRESHOLD:
        stored = gzip.compress(serialized)
    else:
        stored = serialized

    redis_client.setex(key, ttl, stored)

def smart_get(redis_client, key: str):
    data = redis_client.get(key)
    if not data:
        return None

    # 압축 여부 자동 감지
    if data[:2] == MAGIC_BYTES:
        data = gzip.decompress(data)

    return json.loads(data)
```

---

## 압축률 측정

```python
import statistics

class CompressionStats:
    def __init__(self):
        self.ratios = []

    def record(self, original: int, compressed: int):
        self.ratios.append(compressed / original)

    def report(self):
        return {
            "avg_ratio": statistics.mean(self.ratios),
            "min_ratio": min(self.ratios),
            "max_ratio": max(self.ratios),
            "savings_pct": (1 - statistics.mean(self.ratios)) * 100
        }

stats = CompressionStats()

def cache_set_with_stats(redis_client, key: str, data, ttl: int):
    serialized = json.dumps(data).encode()
    compressed = gzip.compress(serialized)
    stats.record(len(serialized), len(compressed))
    redis_client.setex(key, ttl, compressed)
```

---

## Redis 서버 레벨 압축

Redis 자체에는 압축 기능이 없습니다. 하지만 특정 자료구조에서 내부 인코딩으로 압축 효과가 있습니다:

```bash
# Hash, List, Set, ZSet의 ziplist 인코딩
# 요소가 적고 값이 작으면 압축 저장
redis-cli OBJECT ENCODING "my:hash"  # "ziplist" or "hashtable"
```

---

## 선택 기준

```
응답 시간이 최우선 → lz4 (해제 속도 최고)
저장 공간이 최우선 → zstd (압축률/속도 균형)
표준성이 중요      → gzip (어디서나 지원)
소규모 서비스      → 압축 불필요 (복잡도만 증가)
```

---

## 핵심 요약

- 1KB 이상의 JSON에서 압축 효과 (70~90% 절약 가능)
- **gzip**: 표준, 압축률 좋음
- **lz4**: 속도 최우선
- **zstd**: 압축률+속도 균형 (Facebook 개발)
- 임계값(1KB) 이하는 압축 스킵
- 매직 바이트로 자동 압축 여부 감지
