---
title: "브라우저 캐시 동작 방식"
date: 2026-04-12
tags: [http-cache, browser-cache, memory-cache, disk-cache]
---

## 브라우저 캐시 계층

```
요청 → Memory Cache → Disk Cache → Service Worker → 네트워크
```

### Memory Cache

현재 탭의 메모리에 저장. 탭 닫으면 소멸.

```
이미지, JS, CSS 등을 같은 페이지 내에서 재사용
<img src="logo.png"> 여러 번 나와도 한 번만 다운로드
```

### Disk Cache

브라우저 캐시 폴더에 저장. 재시작 후에도 유지.

```
Cache-Control: max-age=3600 → Disk Cache에 1시간 저장
다음 방문 시 네트워크 없이 즉시 로딩
```

---

## 브라우저 캐시 흐름

```
1. 브라우저가 캐시 확인
   → 없음: 네트워크 요청

2. 캐시 있음, max-age 유효 (Fresh)
   → 네트워크 없이 즉시 응답 (200 from cache)

3. 캐시 있음, max-age 만료 (Stale)
   → 조건부 요청 전송
     - ETag 있으면: If-None-Match
     - Last-Modified 있으면: If-Modified-Since

4. 서버 응답
   → 304 Not Modified: 캐시된 것 사용
   → 200 OK: 새 데이터 + 새 캐시
```

---

## Chrome DevTools로 확인

```
Network 탭에서:
  (memory cache)   → Memory Cache 히트
  (disk cache)     → Disk Cache 히트
  Size: 304        → 조건부 요청, 서버에서 Not Modified
  Size: 1.2 kB     → 실제 다운로드
```

---

## 강제 새로고침

```
F5 (새로고침):
  → Cache-Control: max-age=0 포함
  → 캐시 있어도 서버에 재확인 (ETag 사용)

Ctrl+Shift+R (강제 새로고침):
  → Cache-Control: no-cache 포함
  → 캐시 완전 무시, 항상 새로 다운로드

개발자도구 열린 상태에서 새로고침 버튼 우클릭:
  → "캐시 비우기 및 강력 새로고침" 선택 가능
```

---

## Service Worker 캐시

PWA에서 오프라인 지원을 위한 프로그래밍 가능한 캐시:

```javascript
// service-worker.js
const CACHE_NAME = "v1";
const URLS_TO_CACHE = ["/", "/static/main.js", "/static/style.css"];

// 설치 시 사전 캐싱
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

// 요청 인터셉트
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // 캐시 히트 → 반환
      if (response) return response;
      // 미스 → 네트워크
      return fetch(event.request);
    })
  );
});
```

---

## 캐시 디버깅 팁

```bash
# Chrome에서 캐시 완전 초기화
Chrome 주소창: chrome://settings/clearBrowserData
또는: DevTools → Application → Storage → Clear Site Data

# 특정 URL의 캐시 확인
DevTools → Application → Cache Storage
DevTools → Network → Headers 탭에서 응답 헤더 확인
```

---

## 핵심 요약

- 브라우저 캐시: Memory Cache (탭 내) → Disk Cache (재시작 후도 유지)
- max-age 유효: 네트워크 없이 즉시 응답
- max-age 만료: ETag/Last-Modified로 조건부 요청 → 304 or 200
- F5: 서버 재확인 (ETag 사용), Ctrl+Shift+R: 강제 다운로드
- Service Worker: 오프라인 지원, 캐시 직접 제어
