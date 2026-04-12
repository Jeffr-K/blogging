---
title: "Vary 헤더: 조건별 다른 캐시"
date: 2026-04-12
tags: [http-cache, vary, content-negotiation, cdn]
---

## Vary 헤더란

같은 URL이지만 요청 헤더 값에 따라 다른 응답을 캐싱할 때 사용합니다.

```
GET /api/data
Accept-Encoding: gzip
→ 압축된 응답

GET /api/data
Accept-Encoding: identity
→ 미압축 응답

Vary: Accept-Encoding 설정 시 → 두 응답이 별도 캐시 항목
```

---

## 주요 Vary 사용 케이스

### 압축 (가장 흔함)

```http
# 서버 응답
Content-Encoding: gzip
Vary: Accept-Encoding

# 브라우저가 gzip 지원하면 압축 버전 캐시
# 지원 안 하면 미압축 버전 캐시
```

### 언어

```http
# 한국어 응답
Content-Language: ko
Vary: Accept-Language

# 영어 클라이언트는 다른 캐시 항목
```

### 사용자 에이전트 (모바일/데스크톱)

```http
# 모바일 최적화 응답
Vary: User-Agent

# 주의: User-Agent 값이 너무 다양해서 캐시 효율 매우 낮음
# 대신 별도 URL 사용 권장 (/m/... vs /...)
```

---

## Spring에서 Vary 설정

```java
@GetMapping("/api/data")
public ResponseEntity<Data> getData(
    @RequestHeader(value = "Accept-Language", defaultValue = "ko") String lang
) {
    Data data = dataService.findByLanguage(lang);

    return ResponseEntity.ok()
        .varyBy("Accept-Language")
        .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePublic())
        .body(data);
}
```

---

## CDN에서의 Vary 주의사항

```
Vary: Accept-Encoding
  → 대부분 CDN이 잘 처리함

Vary: Accept-Language
  → CloudFront: 화이트리스트에 추가해야 함
  → Cloudflare: 기본 지원

Vary: User-Agent
  → CDN이 캐시 거부하거나 효율 매우 낮음

Vary: *
  → CDN이 아예 캐시 안 함 (완전 캐시 우회)
  → 절대 사용 금지
```

```yaml
# CloudFront 설정 (Vary 헤더 화이트리스트)
ForwardedValues:
  Headers:
    - Accept-Encoding   # 이것만 Vary 허용
    - Accept-Language
```

---

## Content Negotiation과 Vary

```http
# 클라이언트가 원하는 형식 요청
GET /api/data
Accept: application/json

GET /api/data
Accept: application/xml

# 서버
Vary: Accept
Content-Type: application/json  (또는 application/xml)
```

```java
@GetMapping(value = "/api/data",
    produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE})
public ResponseEntity<Data> getData() {
    // Spring이 자동으로 Vary: Accept 추가
    return ResponseEntity.ok(data);
}
```

---

## 핵심 요약

- Vary: 같은 URL, 다른 요청 헤더 → 별도 캐시 항목
- `Vary: Accept-Encoding`: 압축 여부별 캐시 (CDN 안전)
- `Vary: Accept-Language`: 언어별 캐시 (CDN 화이트리스트 필요)
- `Vary: User-Agent`: 캐시 효율 매우 낮음, 사용 지양
- `Vary: *`: CDN 캐시 완전 우회, 절대 금지
