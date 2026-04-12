---
title: "Cache-Control: HTTP 캐시의 핵심"
date: 2026-04-12
tags: [http-cache, cache-control, browser-cache, cdn]
---

## HTTP 캐싱 계층

```
Browser → CDN (엣지 서버) → Origin Server

각 계층이 Cache-Control 헤더에 따라 캐싱 여부 결정
```

---

## Cache-Control 헤더

### 응답 헤더 (서버 → 클라이언트)

```http
# 가장 기본: 60초 캐시
Cache-Control: max-age=3600

# 조합 예시
Cache-Control: public, max-age=86400           # CDN + 브라우저 모두 캐시 (1일)
Cache-Control: private, max-age=3600           # 브라우저만 캐시 (CDN 불가)
Cache-Control: no-cache                        # 항상 서버에 재확인 (캐시 저장은 함)
Cache-Control: no-store                        # 절대 저장 금지
Cache-Control: public, max-age=86400, s-maxage=3600  # CDN=1시간, 브라우저=1일
Cache-Control: must-revalidate, max-age=3600   # 만료 후 반드시 재확인
Cache-Control: stale-while-revalidate=60       # 만료 후 60초간 구버전 사용하며 백그라운드 갱신
```

---

## 지시어 정리

```
max-age=N:           N초 동안 캐시 유효
s-maxage=N:          공유 캐시(CDN)의 max-age (우선 적용)
public:              모든 캐시(CDN 포함) 허용
private:             브라우저만 캐시 (CDN 불가)
no-cache:            캐시 가능하지만 사용 전 서버 재확인 필요
no-store:            어떤 캐시에도 저장 금지
must-revalidate:     만료 후 반드시 origin 재확인
stale-while-revalidate=N: 만료 후 N초간 구버전 반환하며 백그라운드 갱신
immutable:           콘텐츠 변경 안 됨 (브라우저가 조건부 요청 안 함)
```

---

## 요청 헤더 (클라이언트 → 서버)

```http
Cache-Control: no-cache         # 캐시 무시하고 신선한 응답 요청
Cache-Control: no-store         # 응답 저장 금지 요청
Cache-Control: max-age=0        # 만료된 것처럼 처리
Cache-Control: max-stale=60     # 최대 60초 만료된 것까지 허용
```

---

## 콘텐츠 타입별 전략

```http
# 정적 파일 (해시 포함 파일명: main.a3b9c.js)
Cache-Control: public, max-age=31536000, immutable
# → 1년 캐시, 파일명이 바뀌면 새 URL

# HTML (항상 최신)
Cache-Control: no-cache
# → 저장은 하되 항상 서버에 유효성 확인

# API 응답 (개인 데이터)
Cache-Control: private, max-age=300
# → 브라우저만 5분 캐시

# API 응답 (공개 데이터)
Cache-Control: public, max-age=60, s-maxage=300
# → CDN 5분, 브라우저 1분

# 민감 데이터 (금융, 의료)
Cache-Control: no-store
# → 절대 저장 금지
```

---

## Spring에서 Cache-Control 설정

```java
@RestController
public class ProductController {

    @GetMapping("/api/products/{id}")
    public ResponseEntity<Product> getProduct(@PathVariable Long id) {
        Product product = productService.findById(id);

        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES)
                .cachePublic())
            .body(product);
    }

    @GetMapping("/api/users/{id}/profile")
    public ResponseEntity<UserProfile> getProfile(@PathVariable Long id) {
        UserProfile profile = userService.findProfile(id);

        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS)
                .cachePrivate())  // 개인 데이터
            .body(profile);
    }

    @GetMapping("/api/config")
    public ResponseEntity<Config> getConfig() {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS)
                .cachePublic()
                .immutable())    // 변경 안 됨
            .body(configService.get());
    }
}
```

---

## Vary 헤더 (CDN 주의)

```http
# 압축 여부에 따라 다른 캐시
Vary: Accept-Encoding

# 언어에 따라 다른 캐시
Vary: Accept-Language

# 주의: Vary: * → CDN이 캐시 안 함!
```

---

## 핵심 요약

- `max-age=N`: N초 캐시, 이후 재요청
- `public`: CDN + 브라우저 모두 캐시 가능
- `private`: 브라우저만 (로그인 데이터 등)
- `no-cache`: 저장은 하되 매번 재확인
- `no-store`: 아예 저장 금지 (민감 데이터)
- 정적 파일: 파일명에 해시 + `immutable` + 1년 캐시
- `stale-while-revalidate`: 응답 속도 vs 최신성 트레이드오프
