---
title: "실전: 상품 캐싱 전체 구현"
date: 2026-04-12
tags: [cache, e-commerce, product-cache, spring, redis]
---

## 전체 아키텍처

```
사용자 요청
    ↓
[Nginx] CDN 응답 (정적 콘텐츠)
    ↓
[App Server]
    → L1: Caffeine (10초, Hot 상품)
    → L2: Redis (5분, 일반 상품)
    → DB: PostgreSQL (캐시 미스 시)
```

---

## Spring Boot 전체 구현

```java
@Service
public class ProductCacheService {

    private final ProductRepository productRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private final Cache<Long, ProductDetail> localCache;

    public ProductCacheService(ProductRepository repo,
                                RedisTemplate<String, String> redisTemplate,
                                ObjectMapper objectMapper) {
        this.productRepository = repo;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.localCache = Caffeine.newBuilder()
            .maximumSize(500)
            .expireAfterWrite(10, TimeUnit.SECONDS)
            .recordStats()
            .build();
    }

    public ProductDetail getProduct(Long productId) {
        // L1: 로컬 캐시 (10초)
        ProductDetail cached = localCache.getIfPresent(productId);
        if (cached != null) {
            return cached;
        }

        // L2: Redis (5분)
        String key = "product:" + productId;
        String json = redisTemplate.opsForValue().get(key);

        if (json != null) {
            ProductDetail detail = deserialize(json);
            localCache.put(productId, detail);
            return detail;
        }

        // DB 조회
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ProductNotFoundException(productId));

        ProductDetail detail = buildDetail(product);

        // L2 저장 (Jitter 포함)
        int ttl = 300 + ThreadLocalRandom.current().nextInt(-30, 30);
        redisTemplate.opsForValue().set(key, serialize(detail),
            Duration.ofSeconds(ttl));

        // L1 저장
        localCache.put(productId, detail);
        return detail;
    }

    @Transactional
    public Product updateProduct(Long productId, ProductUpdateRequest request) {
        Product product = productRepository.findById(productId)
            .orElseThrow(() -> new ProductNotFoundException(productId));

        product.update(request);
        productRepository.save(product);

        // 캐시 무효화
        invalidateProductCache(productId);
        return product;
    }

    public void invalidateProductCache(Long productId) {
        // L1 무효화
        localCache.invalidate(productId);

        // L2 무효화
        String key = "product:" + productId;
        redisTemplate.delete(key);

        // 관련 목록 캐시도 무효화
        Set<String> listKeys = redisTemplate.keys("product:list:*");
        if (listKeys != null && !listKeys.isEmpty()) {
            redisTemplate.delete(listKeys);
        }
    }

    private ProductDetail buildDetail(Product product) {
        // 상품 + 리뷰 요약 + 재고 상태 조합
        return ProductDetail.builder()
            .id(product.getId())
            .name(product.getName())
            .price(product.getPrice())
            .description(product.getDescription())
            // 재고는 캐시 안 함 - 실시간 조회
            .build();
    }
}
```

---

## 재고는 별도 처리 (캐시 안 함)

```java
@Service
public class StockService {

    // 재고는 캐시 없이 Redis 원자 연산 사용
    public boolean deductStock(Long productId, int quantity) {
        String key = "stock:" + productId;

        // Lua 스크립트로 원자적 감소
        String script = """
            local stock = tonumber(redis.call('GET', KEYS[1]) or '0')
            if stock < tonumber(ARGV[1]) then return 0 end
            return redis.call('DECRBY', KEYS[1], ARGV[1])
        """;

        Long result = redisTemplate.execute(
            new DefaultRedisScript<>(script, Long.class),
            List.of(key),
            String.valueOf(quantity)
        );

        return result != null && result >= 0;
    }

    public int getStock(Long productId) {
        // 재고는 캐시 없이 Redis에서 직접 (DB 동기화는 별도 배치)
        String val = redisTemplate.opsForValue().get("stock:" + productId);
        return val != null ? Integer.parseInt(val) : 0;
    }
}
```

---

## 목록 캐싱 (페이지네이션)

```java
@Cacheable(
    value = "product-list",
    key = "#category + ':' + #page",
    unless = "#result.isEmpty()"
)
public List<ProductSummary> getProductsByCategory(String category, int page) {
    return productRepository.findByCategory(
        category, PageRequest.of(page, 20)
    ).getContent();
}

// 상품 업데이트 시 해당 카테고리 목록 전체 무효화
@CacheEvict(value = "product-list", key = "#product.category + ':*'")
public void onProductUpdated(Product product) { }
```

---

## Bloom Filter로 없는 상품 차단

```java
@Component
public class ProductBloomFilter {

    private final RedisTemplate<String, String> redisTemplate;
    private static final String BF_KEY = "bf:products";

    public void add(Long productId) {
        redisTemplate.execute(
            (RedisCallback<?>) conn ->
                conn.execute("BF.ADD", BF_KEY.getBytes(),
                    String.valueOf(productId).getBytes())
        );
    }

    public boolean mightExist(Long productId) {
        Object result = redisTemplate.execute(
            (RedisCallback<?>) conn ->
                conn.execute("BF.EXISTS", BF_KEY.getBytes(),
                    String.valueOf(productId).getBytes())
        );
        return Long.valueOf(1).equals(result);
    }
}

// 컨트롤러에서 사용
@GetMapping("/{id}")
public ProductDetail getProduct(@PathVariable Long id) {
    if (!bloomFilter.mightExist(id)) {
        throw new ProductNotFoundException(id);  // DB 조회 없이 즉시 404
    }
    return productCacheService.getProduct(id);
}
```

---

## 핵심 요약

- 상품 정보: Two-Level Cache (L1=10초, L2=5분) + Jitter
- 재고: 캐시 없이 Redis 원자 연산 (Lua) 직접 사용
- 가격: Write-Through (DB+캐시 동시, 구버전 불허)
- 목록: @Cacheable + 카테고리 기반 무효화
- 없는 상품: Bloom Filter로 DB 조회 차단
- 업데이트: L1 + L2 동시 무효화
