---
title: "API 응답 캐싱 패턴"
date: 2026-04-12
tags: [cache, api-cache, response-cache, spring, redis]
---

## API 응답 캐싱이란

전체 HTTP 응답(status code + headers + body)을 캐시합니다. 개별 데이터가 아닌 완성된 응답을 저장합니다.

```
기존: 요청 → 비즈니스 로직 → 직렬화 → 응답
캐싱: 요청 → 캐시 히트 → 저장된 응답 반환 (로직 스킵)
```

---

## Spring ResponseBodyAdvice로 응답 캐싱

```java
@Component
public class ApiCacheInterceptor implements HandlerInterceptor {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    @Override
    public boolean preHandle(HttpServletRequest request,
                              HttpServletResponse response,
                              Object handler) throws Exception {
        if (!"GET".equals(request.getMethod())) {
            return true;  // GET 요청만 캐싱
        }

        String cacheKey = buildCacheKey(request);
        String cached = redisTemplate.opsForValue().get(cacheKey);

        if (cached != null) {
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(cached);
            return false;  // 컨트롤러 실행 중단
        }

        return true;
    }

    private String buildCacheKey(HttpServletRequest request) {
        return "api:" + request.getRequestURI() +
               (request.getQueryString() != null ? "?" + request.getQueryString() : "");
    }
}
```

---

## @Cacheable로 메서드 응답 캐싱

```java
@RestController
@RequestMapping("/api/products")
public class ProductController {

    @GetMapping("/{id}")
    @Cacheable(value = "product-response", key = "#id")
    public ProductDetailResponse getProduct(@PathVariable Long id) {
        return productService.buildDetailResponse(id);
    }

    @GetMapping
    @Cacheable(
        value = "product-list",
        key = "#category + ':' + #page + ':' + #size",
        condition = "#page < 10"  // 1~10페이지만 캐시
    )
    public Page<ProductSummary> getProducts(
        @RequestParam String category,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return productService.findByCategory(category, PageRequest.of(page, size));
    }
}
```

---

## FastAPI 미들웨어로 응답 캐싱

```python
from fastapi import FastAPI, Request, Response
import hashlib
import json

app = FastAPI()

@app.middleware("http")
async def cache_middleware(request: Request, call_next):
    # GET 요청만, 인증 없는 요청만 캐시
    if request.method != "GET" or request.headers.get("Authorization"):
        return await call_next(request)

    # 캐시 키: URL + 쿼리 파라미터
    cache_key = f"api:{request.url}"

    cached = redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        return Response(
            content=data["body"],
            status_code=data["status_code"],
            headers={"Content-Type": "application/json", "X-Cache": "HIT"}
        )

    # 응답 생성
    response = await call_next(request)

    # 200 OK만 캐시
    if response.status_code == 200:
        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        ttl = get_ttl_for_path(request.url.path)
        redis.setex(cache_key, ttl, json.dumps({
            "body": body.decode(),
            "status_code": 200
        }))

        return Response(
            content=body,
            status_code=200,
            headers={"Content-Type": "application/json", "X-Cache": "MISS"}
        )

    return response

def get_ttl_for_path(path: str) -> int:
    if "/products/" in path:
        return 300   # 5분
    if "/ranking" in path:
        return 60    # 1분
    if "/config" in path:
        return 3600  # 1시간
    return 120       # 기본 2분
```

---

## 캐시 무효화 전략

```python
# URL 패턴으로 관련 캐시 일괄 삭제
def invalidate_product_cache(product_id: int):
    # 특정 상품 캐시
    redis.delete(f"api:/api/products/{product_id}")

    # 상품 목록 캐시 (모든 카테고리)
    pattern = "api:/api/products*"
    for key in scan_keys(redis, pattern):
        redis.delete(key)

# 또는 태그 기반
@tag_cache(tags=["product", f"product:{product_id}"])
def get_product(product_id: int):
    ...

def update_product(product_id: int, data: dict):
    db.update(product_id, data)
    invalidate_by_tag(f"product:{product_id}")  # 관련 캐시 모두 삭제
```

---

## 캐시할 때 vs 말 때

```
캐시 O:
  - 공개 데이터 (로그인 불필요)
  - 동일 파라미터로 반복 조회
  - DB 쿼리 비용이 높음
  - 데이터 변경이 드묾

캐시 X:
  - 개인화된 응답 (내 피드, 내 장바구니)
  - 실시간 데이터 (잔액, 재고)
  - POST/PUT/DELETE 요청
  - 한 번만 조회하는 데이터
```

---

## 핵심 요약

- API 응답 캐싱: 완성된 응답 전체를 캐시 → 비즈니스 로직 스킵
- Spring: `@Cacheable` 또는 `HandlerInterceptor`
- FastAPI: `@app.middleware("http")`
- 경로별 다른 TTL: `/ranking`=60초, `/products`=5분, `/config`=1시간
- 개인화 응답, 실시간 데이터는 캐시하지 않음
