---
title: "Cache Busting: 캐시 무효화 전략"
date: 2026-04-12
tags: [http-cache, cache-busting, versioning, deployment]
---

## 문제: 긴 TTL과 즉시 반영의 모순

```
정적 파일에 max-age=31536000 (1년) 설정
→ 브라우저/CDN이 1년간 캐시
→ 새 배포해도 사용자는 구버전 사용
```

**Cache Busting:** 파일이 바뀔 때 URL도 바꿔서 기존 캐시를 우회합니다.

---

## 방법 1: 파일명에 해시 포함 (권장)

```
빌드 전: main.js, style.css
빌드 후: main.a3f9b2c1.js, style.8e4d1f2a.css

내용이 바뀌면 해시도 바뀜 → 새 URL → CDN이 새 파일 요청
내용이 안 바뀌면 해시도 그대로 → CDN 캐시 그대로 활용
```

```javascript
// webpack.config.js
module.exports = {
  output: {
    filename: "[name].[contenthash].js",  // 내용 해시
    chunkFilename: "[name].[contenthash].chunk.js",
  }
}
```

```html
<!-- 빌드 결과 HTML -->
<script src="/static/main.a3f9b2c1.js"></script>
<link rel="stylesheet" href="/static/style.8e4d1f2a.css">
```

**장점:** 변경된 파일만 새로 로딩, 변경 없는 파일은 캐시 그대로

---

## 방법 2: 쿼리 파라미터 버전

```html
<script src="/static/main.js?v=20260412"></script>
<link rel="stylesheet" href="/static/style.css?v=1.2.3">
```

**단점:** 일부 CDN은 쿼리 파라미터가 다르면 별개 리소스로 취급 안 함  
→ 파일명 해시보다 신뢰성 낮음

---

## 방법 3: HTML은 no-cache

```http
# HTML 파일: 항상 최신 버전 (JS/CSS URL 포함)
Cache-Control: no-cache

# JS/CSS: 파일명 해시로 1년 캐시
Cache-Control: public, max-age=31536000, immutable
```

```
흐름:
  브라우저가 HTML 요청 → 서버에 재확인 (304 or 새 HTML)
  새 HTML에 새 JS 파일명 → 브라우저가 새 JS 요청
  구 JS 파일명 그대로면 → 캐시에서 즉시 로딩
```

---

## 방법 4: API 버저닝

```
URL 버전:
  /api/v1/users
  /api/v2/users   ← 새 버전

헤더 버전:
  Accept: application/vnd.myapp.v2+json
```

---

## Spring Boot 정적 파일 설정

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/static/**")
            .addResourceLocations("classpath:/static/")
            .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS)
                .cachePublic()
                .immutable())
            .resourceChain(true)
            .addResolver(new VersionResourceResolver()
                .addContentVersionStrategy("/**"));  // 내용 해시 자동 추가
    }
}
```

```html
<!-- Thymeleaf에서 버전 URL 자동 생성 -->
<script th:src="@{/static/main.js}"></script>
<!-- 결과: <script src="/static/main-a3f9b2c1.js"></script> -->
```

---

## 배포 체크리스트

```
배포 시:
  □ JS/CSS 파일명에 contenthash 포함
  □ HTML은 no-cache 또는 짧은 max-age
  □ CDN 무효화 (HTML, 변경된 API 응답)
  □ 이전 버전 파일 일정 기간 유지 (롤링 배포 중인 사용자 위해)

이전 파일 유지 기간:
  롤링 배포 완료 시간 + 여유 (보통 1~7일)
```

---

## 핵심 요약

- Cache Busting: URL 변경으로 캐시 우회
- **파일명 해시**: 가장 권장 (`[contenthash]`)
- **HTML**: `no-cache` → 항상 최신 JS/CSS URL 포함
- **JS/CSS**: `immutable` + 1년 → 변경 시 새 URL
- CDN 무효화: HTML + API 응답 대상, 정적 파일은 파일명 바뀌므로 불필요
