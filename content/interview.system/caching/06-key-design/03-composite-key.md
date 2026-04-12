---
title: "복합 키와 파라미터 캐싱"
date: 2026-04-12
tags: [cache, composite-key, query-cache, parameter]
---

## 복합 키란

여러 파라미터로 결정되는 데이터를 캐싱할 때 사용합니다.

```
단순 키:
  user:42 → 유저 42의 기본 정보

복합 키:
  search:keyword=shirt&size=M&color=blue&page=1 → 검색 결과
  report:user=42&from=2026-01&to=2026-03 → 기간별 리포트
  feed:user=42&cursor=abc&limit=20 → 페이지네이션 피드
```

---

## 복합 키 생성 방법

### 방법 1: 파라미터 정렬 후 연결

```python
def make_search_key(keyword: str, filters: dict) -> str:
    """
    파라미터 순서가 달라도 같은 키 생성
    {color: blue, size: M} == {size: M, color: blue}
    """
    sorted_params = sorted(filters.items())
    params_str = "&".join(f"{k}={v}" for k, v in sorted_params)
    return f"search:{keyword}:{params_str}"

# 사용
key1 = make_search_key("shirt", {"size": "M", "color": "blue"})
key2 = make_search_key("shirt", {"color": "blue", "size": "M"})
assert key1 == key2  # True: "search:shirt:color=blue&size=M"
```

### 방법 2: 해시 (키가 너무 길 때)

```python
import hashlib
import json

def make_query_key(prefix: str, params: dict) -> str:
    """파라미터를 해시해서 고정 길이 키 생성"""
    sorted_params = dict(sorted(params.items()))
    params_json = json.dumps(sorted_params, ensure_ascii=False)
    params_hash = hashlib.sha256(params_json.encode()).hexdigest()[:16]
    return f"{prefix}:{params_hash}"

# 사용
key = make_query_key("search", {
    "keyword": "shirt",
    "color": "blue",
    "size": "M",
    "price_min": 10000,
    "price_max": 50000,
    "brand": "nike"
})
# "search:a3f9e2b1c4d5e6f7"

# 디버깅을 위해 파라미터도 함께 저장
def cache_with_meta(redis_client, key: str, value, params: dict, ttl: int):
    pipeline = redis_client.pipeline()
    pipeline.setex(key, ttl, serialize(value))
    pipeline.setex(f"{key}:meta", ttl, json.dumps(params))
    pipeline.execute()
```

---

## @Cacheable의 복합 키 (Spring)

```java
@Service
public class SearchService {

    // SpEL로 복합 키 생성
    @Cacheable(
        value = "search",
        key = "#keyword + ':' + #filters.size + ':' + #filters.color + ':' + #page"
    )
    public SearchResult search(String keyword, FilterDTO filters, int page) {
        return db.search(keyword, filters, page);
    }

    // 커스텀 KeyGenerator 사용
    @Cacheable(value = "report", keyGenerator = "sortedParamKeyGenerator")
    public Report getReport(ReportRequest request) {
        return db.generateReport(request);
    }
}

@Component("sortedParamKeyGenerator")
public class SortedParamKeyGenerator implements KeyGenerator {
    @Override
    public Object generate(Object target, Method method, Object... params) {
        return Arrays.stream(params)
            .map(p -> {
                if (p instanceof Map) {
                    return new TreeMap<>((Map<?, ?>) p).toString();
                }
                return p.toString();
            })
            .collect(Collectors.joining(":"));
    }
}
```

---

## 파라미터 정규화

같은 의미의 다른 파라미터 표현을 통일합니다:

```python
def normalize_search_params(params: dict) -> dict:
    normalized = {}

    # 키워드 정규화
    if "keyword" in params:
        normalized["keyword"] = params["keyword"].strip().lower()

    # 가격 범위 정규화
    if "price_min" in params:
        normalized["price_min"] = max(0, int(params["price_min"]))
    if "price_max" in params:
        # None이면 최대값으로 통일
        normalized["price_max"] = int(params["price_max"]) if params.get("price_max") else 999_999_999

    # 정렬 기준 정규화 (기본값 명시)
    normalized["sort"] = params.get("sort", "relevance")

    # 페이지 기본값
    normalized["page"] = max(1, int(params.get("page", 1)))

    return normalized

# 사용
params1 = {"keyword": "  Shirt  ", "price_max": None, "page": 1}
params2 = {"keyword": "shirt", "price_max": 999999999, "page": 1}

# 정규화 후 같은 키
key1 = make_search_key(normalize_search_params(params1))
key2 = make_search_key(normalize_search_params(params2))
assert key1 == key2  # True
```

---

## 키 폭발 방지

파라미터 조합이 너무 많으면 캐시가 의미 없습니다:

```python
# 너무 많은 조합: 캐시 히트율 0%에 수렴
# keyword: 10만 개
# color: 100가지
# size: 20가지
# price_min/max: 무한대
# → 사실상 같은 조합이 다시 조회될 확률 거의 없음

# 해결: 캐시 적합한 파라미터만 선별
CACHEABLE_PARAMS = {"category", "brand", "sort", "page"}
NON_CACHEABLE_PARAMS = {"keyword", "price_min", "price_max"}

def should_cache(params: dict) -> bool:
    """자유 텍스트 검색은 캐시하지 않음"""
    if params.get("keyword"):
        return False
    return True

# 카테고리/브랜드 검색만 캐시 (조합 수 제한적)
# 키워드 검색은 캐시 스킵 (DB 직접 조회)
```

---

## 핵심 요약

- 복합 키: 여러 파라미터를 정렬 후 조합 → 순서 무관 동일 키
- 키가 길 때: SHA256 해시 + 메타 저장
- Spring: SpEL 또는 커스텀 KeyGenerator
- 파라미터 정규화: 같은 의미 → 같은 키
- 키 폭발 방지: 캐시 가치 없는 자유 텍스트는 제외
