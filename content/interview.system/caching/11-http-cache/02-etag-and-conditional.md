---
title: "ETag와 조건부 요청"
date: 2026-04-12
tags: [http-cache, etag, conditional-request, last-modified]
---

## 왜 조건부 요청이 필요한가

```
max-age가 만료됐지만 실제 데이터가 바뀌지 않았다면?
  → 전체 응답을 다시 받는 것은 낭비

조건부 요청: "이 버전이 최신이면 304만 보내줘"
  → 데이터가 같으면 304 Not Modified (body 없음)
  → 변경됐으면 200 OK + 새 데이터
```

---

## ETag (Entity Tag)

리소스의 버전을 나타내는 식별자입니다.

```http
# 서버 응답
HTTP/1.1 200 OK
ETag: "abc123def456"
Cache-Control: max-age=3600
Content-Type: application/json

{"id": 42, "name": "Alice"}
```

```http
# 만료 후 클라이언트 재요청 (If-None-Match)
GET /api/users/42
If-None-Match: "abc123def456"

# 서버: 변경 없음
HTTP/1.1 304 Not Modified
ETag: "abc123def456"
# body 없음! → 대역폭 절약

# 서버: 변경됨
HTTP/1.1 200 OK
ETag: "xyz789"
Content-Type: application/json

{"id": 42, "name": "Alice K"}
```

---

## ETag 생성

```python
import hashlib
import json

def generate_etag(data) -> str:
    """데이터의 해시값을 ETag로 사용"""
    content = json.dumps(data, sort_keys=True).encode()
    return hashlib.md5(content).hexdigest()

# Flask 예시
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)

@app.route("/api/users/<int:user_id>")
def get_user(user_id):
    user = db.find_user(user_id)
    etag = generate_etag(user)

    # 조건부 요청 처리
    if request.headers.get("If-None-Match") == f'"{etag}"':
        return "", 304  # Not Modified

    response = make_response(jsonify(user))
    response.headers["ETag"] = f'"{etag}"'
    response.headers["Cache-Control"] = "private, max-age=3600"
    return response
```

```java
// Spring
@GetMapping("/api/users/{id}")
public ResponseEntity<User> getUser(
    @PathVariable Long id,
    @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch
) {
    User user = userService.findById(id);
    String etag = generateEtag(user);

    if (etag.equals(ifNoneMatch)) {
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED).build();
    }

    return ResponseEntity.ok()
        .eTag(etag)
        .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePrivate())
        .body(user);
}

// ShallowEtagHeaderFilter: Spring이 자동으로 ETag 처리
@Bean
public Filter shallowEtagHeaderFilter() {
    return new ShallowEtagHeaderFilter();
}
```

---

## Last-Modified (날짜 기반)

ETag 대신 마지막 수정 시각을 사용합니다:

```http
# 서버 응답
HTTP/1.1 200 OK
Last-Modified: Thu, 01 Jan 2026 00:00:00 GMT
Cache-Control: max-age=3600

# 클라이언트 재요청
GET /api/products/1001
If-Modified-Since: Thu, 01 Jan 2026 00:00:00 GMT

# 서버: 변경 없음
HTTP/1.1 304 Not Modified
```

```python
from datetime import datetime, timezone
from email.utils import formatdate

@app.route("/api/products/<int:product_id>")
def get_product(product_id):
    product = db.find_product(product_id)
    last_modified = product["updated_at"]  # datetime 객체

    if_modified_since = request.headers.get("If-Modified-Since")
    if if_modified_since:
        client_time = datetime.strptime(if_modified_since, "%a, %d %b %Y %H:%M:%S %Z")
        if last_modified <= client_time.replace(tzinfo=timezone.utc):
            return "", 304

    response = make_response(jsonify(product))
    response.headers["Last-Modified"] = formatdate(last_modified.timestamp())
    return response
```

---

## ETag vs Last-Modified

| | ETag | Last-Modified |
|--|------|--------------|
| 정확도 | 정확 (내용 기반) | 1초 단위 (같은 초 변경 못 감지) |
| 생성 비용 | 해시 계산 | DB timestamp |
| 권장 상황 | 기본 권장 | ETag 계산 비용이 클 때 |

**둘 다 있으면:** ETag 우선 적용

---

## 캐시 히트 흐름 정리

```
첫 번째 요청:
  GET /api/users/42
  → 200 OK + ETag: "abc" + Cache-Control: max-age=3600

1시간 내 재요청:
  캐시에서 즉시 응답 (HTTP 요청 없음)

1시간 후 재요청:
  GET /api/users/42
  If-None-Match: "abc"
  → 변경 없음: 304 Not Modified (body 없음)
  → 변경됨: 200 OK + ETag: "xyz" + 새 데이터
```

---

## 핵심 요약

- ETag: 리소스 버전 식별자 (내용 해시)
- 304 Not Modified: 데이터 동일, body 없음 → 대역폭 절약
- `If-None-Match`: ETag 기반 조건부 요청
- `If-Modified-Since`: 날짜 기반 조건부 요청
- Spring `ShallowEtagHeaderFilter`: 자동 ETag 처리
- ETag + max-age 조합: 만료 전 캐시 사용, 만료 후 조건부 재확인
