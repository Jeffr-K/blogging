---
title: "CDN 캐싱 전략"
date: 2026-04-12
tags: [cdn, http-cache, cloudfront, cloudflare, edge]
---

## CDN이란

Content Delivery Network: 전 세계에 분산된 엣지 서버가 콘텐츠를 캐싱합니다.

```
없이:     한국 사용자 → 미국 Origin → 200ms
CDN 사용: 한국 사용자 → 한국 엣지 → 5ms (CDN 히트 시)
```

---

## CDN 동작 원리

```
최초 요청 (Cache Miss):
  사용자 → CDN 엣지 → Origin 서버
  Origin: 200 OK + Cache-Control: max-age=3600
  CDN: 응답을 엣지에 저장 + 사용자에게 전달

이후 요청 (Cache Hit):
  사용자 → CDN 엣지 (즉시 응답, Origin 요청 없음)
```

---

## s-maxage: CDN 전용 TTL

```http
# 브라우저: 5분, CDN: 1시간
Cache-Control: public, max-age=300, s-maxage=3600

# CDN만 캐시 (브라우저는 항상 CDN에 요청)
Cache-Control: public, no-store, s-maxage=3600
# s-maxage가 있으면 public 자동 적용
```

---

## CDN 무효화 (Purge)

캐시된 콘텐츠를 즉시 삭제합니다:

```bash
# CloudFront 무효화
aws cloudfront create-invalidation \
  --distribution-id EDFDVBD6EXAMPLE \
  --paths "/api/products/1001" "/images/hero.jpg" "/css/*"

# Cloudflare 무효화
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"files": ["https://example.com/api/products/1001"]}'
```

```python
# 배포 시 자동 무효화 (Python)
import boto3

def invalidate_cloudfront(paths: list[str], distribution_id: str):
    cf = boto3.client("cloudfront")
    cf.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": len(paths), "Items": paths},
            "CallerReference": str(time.time())
        }
    )

# 데이터 업데이트 시
def update_product(product_id: int, data: dict):
    db.update(product_id, data)
    redis.delete(f"product:{product_id}")

    # CDN에서도 제거
    invalidate_cloudfront(
        paths=[f"/api/products/{product_id}"],
        distribution_id="EDFDVBD6EXAMPLE"
    )
```

---

## CDN 캐싱 전략

### 정적 파일 (JS, CSS, 이미지)

```http
Cache-Control: public, max-age=31536000, immutable
```

파일명에 내용 해시 포함:
```
main.bundle.js      → 캐시 무효화 어려움
main.a3f9b2c1.js    → 배포 시 새 URL → 무효화 불필요
```

### API 응답 (공개 데이터)

```http
Cache-Control: public, s-maxage=300, stale-while-revalidate=60
```

### API 응답 (개인 데이터)

```http
Cache-Control: private, max-age=60
# CDN 캐시 안 함 (Authorization, Cookie 있으면 자동)
```

---

## CDN 캐시 우회 케이스

```http
# 이 헤더들이 있으면 CDN이 캐시 안 함 (기본값)
Authorization: Bearer token...
Cookie: session=abc123...
Set-Cookie: ...

# Vary: Authorization → 인증 헤더별로 다른 캐시
# 하지만 대부분 CDN은 Vary: Authorization 시 캐시 안 함
```

---

## CloudFront 설정 예시

```yaml
# CloudFront Distribution 설정
CacheBehaviors:
  - PathPattern: "/api/public/*"
    CachePolicyId: "public-api-policy"
    ViewerProtocolPolicy: redirect-to-https
    AllowedMethods: [GET, HEAD]
    CachedMethods: [GET, HEAD]

  - PathPattern: "/api/private/*"
    CachePolicyId: "no-cache-policy"   # 캐시 없음
    ViewerProtocolPolicy: redirect-to-https
    ForwardedValues:
      Cookies: {Forward: all}
      QueryString: true
      Headers: [Authorization]

  - PathPattern: "/static/*"
    CachePolicyId: "long-term-cache"   # 1년 캐시
```

---

## 핵심 요약

- CDN: 엣지에서 캐시 → 지연시간 수십ms → 수ms
- `s-maxage`: CDN 전용 TTL (`max-age`보다 우선)
- 정적 파일: 파일명 해시 + `immutable` + 1년
- 무효화: `aws cloudfront create-invalidation` 또는 API
- 개인 데이터: `private` → CDN 캐시 안 됨
- Cookie/Authorization 있으면 CDN 자동 우회
