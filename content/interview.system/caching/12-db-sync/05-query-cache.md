---
title: "쿼리 결과 캐싱"
date: 2026-04-12
tags: [cache, query-cache, db, hibernate, spring]
---

## 쿼리 결과 캐싱이란

DB 쿼리의 결과를 캐시에 저장해 반복 조회를 피하는 패턴입니다.

```
첫 번째 요청:
  SELECT * FROM products WHERE category = 'electronics'
  → DB 쿼리 실행 → 결과를 Redis에 저장

두 번째 요청:
  Redis에서 즉시 반환 (DB 쿼리 없음)
```

---

## 수동 구현 (Cache-Aside)

```python
import hashlib
import json

def query_with_cache(sql: str, params: tuple, ttl: int = 300):
    # 쿼리 + 파라미터로 캐시 키 생성
    cache_key = "query:" + hashlib.sha256(
        f"{sql}:{json.dumps(params)}".encode()
    ).hexdigest()[:16]

    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    result = db.execute(sql, params)
    redis.setex(cache_key, ttl, json.dumps(result))
    return result

# 사용
products = query_with_cache(
    "SELECT * FROM products WHERE category = %s LIMIT 20",
    ("electronics",),
    ttl=300
)
```

---

## Spring Data JPA + @Cacheable

```java
@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    @Cacheable(value = "products", key = "#category + ':' + #pageable.pageNumber")
    @Query("SELECT p FROM Product p WHERE p.category = :category")
    Page<Product> findByCategory(
        @Param("category") String category,
        Pageable pageable
    );
}

@Service
public class ProductService {

    @Cacheable(value = "products:search",
               key = "#keyword + ':' + #page",
               unless = "#result.isEmpty()")  // 빈 결과는 캐시 안 함
    public List<Product> search(String keyword, int page) {
        return productRepository.search(keyword, PageRequest.of(page, 20));
    }

    @CacheEvict(value = {"products", "products:search"}, allEntries = true)
    public void createProduct(Product product) {
        productRepository.save(product);
    }
}
```

---

## Hibernate Second-Level Cache

JPA/Hibernate의 L2 캐시. 엔티티와 쿼리 결과를 캐싱합니다.

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.hibernate</groupId>
    <artifactId>hibernate-redis</artifactId>
</dependency>
```

```yaml
# application.yml
spring:
  jpa:
    properties:
      hibernate:
        cache:
          use_second_level_cache: true
          use_query_cache: true
          region.factory_class: org.hibernate.cache.redis.hibernate.RedisRegionFactory
```

```java
@Entity
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)  // 엔티티 캐시
public class Product {
    @Id
    private Long id;
    private String name;
    // ...
}

// 쿼리 캐시
TypedQuery<Product> query = em.createQuery(
    "SELECT p FROM Product p WHERE p.category = :category",
    Product.class
);
query.setParameter("category", "electronics");
query.setHint("org.hibernate.cacheable", true);  // 쿼리 결과 캐시
```

---

## 캐시 무효화 전략

```python
# 관련 캐시 전체 무효화 (간단하지만 과도한 무효화)
def create_product(data: dict):
    db.insert(data)
    # 모든 product 관련 캐시 삭제
    pattern = "query:product:*"
    for key in scan_keys(redis, pattern):
        redis.delete(key)

# 태그 기반 무효화 (더 정밀)
CATEGORY_CACHE_TAG = "category:{category}"

def get_by_category(category: str):
    key = f"products:cat:{category}"
    tag = CATEGORY_CACHE_TAG.format(category=category)

    cached = redis.get(key)
    if cached:
        return json.loads(cached)

    result = db.query_by_category(category)
    redis.setex(key, 300, json.dumps(result))
    redis.sadd(tag, key)  # 태그에 키 등록
    return result

def invalidate_category(category: str):
    tag = CATEGORY_CACHE_TAG.format(category=category)
    keys = redis.smembers(tag)
    if keys:
        redis.delete(*keys)
    redis.delete(tag)
```

---

## 주의사항

```
1. 복잡한 쿼리일수록 무효화가 어려움
   - JOIN, 집계 쿼리는 어떤 테이블 변경 시 무효화할지 판단 어려움

2. 결과가 클 때
   - 수백~수천 행의 쿼리 결과 → 직렬화 비용 주의

3. 캐시 가치 판단
   - 자주 바뀌는 데이터는 캐시 효과 없음
   - 동일 쿼리가 얼마나 반복되는지 확인 후 결정
```

---

## 핵심 요약

- 쿼리 캐시: 동일 쿼리 반복 시 DB 부하 절감
- 캐시 키: SQL + 파라미터 해시
- Spring: `@Cacheable`, `@CacheEvict`로 선언적 처리
- Hibernate L2 Cache: 엔티티/쿼리 캐시 내장
- 무효화: 관련 테이블 변경 시 태그 기반으로 정밀 무효화
- 자주 바뀌는 데이터에는 캐시 가치 낮음
