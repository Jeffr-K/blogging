# Spring Cache Abstraction 완전 학습 인덱스

---

## 1. 개요 & 배경

### Spring Cache Abstraction이란?
- 캐시 추상화의 목적 — 비즈니스 로직과 캐시 기술 분리
- AOP 기반 선언적 캐싱 (`@Cacheable`, `@CachePut`, `@CacheEvict`)
- 캐시 추상화 vs 직접 캐시 API 사용 비교
- 지원되는 캐시 구현체 목록 (Caffeine, Redis, EhCache, Hazelcast, Infinispan, ConcurrentMap 등)
- Spring Boot Auto Configuration과의 관계

### 캐싱이 필요한 상황
- DB 쿼리 결과 재사용 (읽기 중심 데이터)
- 외부 API 응답 캐싱
- 무거운 연산 결과 재사용
- 세션/인증 정보 임시 저장
- 캐시 적용 전후 성능 측정 방법

---

## 2. 기본 설정

### @EnableCaching
- `@EnableCaching` 어노테이션 활성화
- `@SpringBootApplication` 클래스 vs 별도 `@Configuration`
- `proxyTargetClass` 옵션 — CGLib vs JDK 동적 프록시
- Spring Boot Auto Configuration (`CacheAutoConfiguration`)

### CacheManager 선택
- `ConcurrentMapCacheManager` — 기본값, 개발/테스트용
- `CaffeineCacheManager` — 로컬 인메모리 (운영 권장)
- `RedisCacheManager` — 분산 캐시
- `EhCacheCacheManager` — EhCache 2.x
- `JCacheCacheManager` — JSR-107(JCache) 통합
- 복수 CacheManager 등록 (`CompositeCacheManager`)

### spring.cache.* 설정
- `spring.cache.type` — 캐시 구현체 명시
- `spring.cache.cache-names` — 캐시 이름 사전 등록
- 캐시 타입 자동 감지 순서

---

## 3. 핵심 어노테이션

### @Cacheable
- 기본 사용법 — 메서드 반환값 캐시 저장
- `value` / `cacheNames` — 캐시 이름 지정
- `key` — SpEL로 캐시 키 지정
- `condition` — 캐시 저장 조건 (메서드 실행 전 평가)
- `unless` — 캐시 저장 제외 조건 (메서드 실행 후 평가)
- `sync` — 동시 요청 시 단일 로더 실행 (캐시 스탬피드 방지)
- `cacheManager` — 특정 CacheManager 지정
- `keyGenerator` — 커스텀 KeyGenerator 지정

### @CachePut
- 항상 메서드를 실행하고 결과를 캐시에 갱신
- `@Cacheable` vs `@CachePut` 차이
- 생성/수정 시 캐시 동기화 패턴
- 동일 `key` 조건 유지의 중요성

### @CacheEvict
- 단일 항목 제거 vs 전체 제거 (`allEntries = true`)
- `beforeInvocation` — 메서드 실행 전/후 제거 시점 선택
- 예외 발생 시 동작 차이 (`beforeInvocation` true vs false)
- 삭제 시나리오에서의 활용 패턴

### @Caching
- 여러 캐시 어노테이션 조합
- 복잡한 캐시 갱신 시나리오 (여러 캐시 동시 처리)
- 같은 메서드에 `@Cacheable` + `@CacheEvict` 조합

### @CacheConfig
- 클래스 레벨 공통 캐시 설정
- `cacheNames`, `cacheManager`, `keyGenerator` 상속
- 메서드 레벨 설정이 클래스 레벨을 오버라이드하는 규칙

---

## 4. 캐시 키 전략

### 기본 KeyGenerator
- 매개변수 없음 → `SimpleKey.EMPTY`
- 매개변수 1개 → 해당 객체 자체
- 매개변수 2개 이상 → `SimpleKey(params...)`
- 기본 키 충돌 시나리오와 주의사항

### SpEL 표현식으로 키 지정
- `#param` — 파라미터명 참조
- `#p0`, `#a0` — 인덱스 기반 참조
- `#root.method`, `#root.target`, `#root.args`
- `#result` — 반환값 참조 (`@CachePut`, `@CacheEvict`의 `unless`)
- 복합 키: `#userId + ':' + #productId`
- `T(...)` — 정적 메서드 호출

### 커스텀 KeyGenerator
- `KeyGenerator` 인터페이스 구현
- `@Bean` 등록 및 `keyGenerator` 속성 참조
- 메서드 시그니처 기반 자동 키 생성 전략
- 네임스페이스 충돌 방지 패턴

---

## 5. Caffeine 캐시 (로컬 인메모리)

### Caffeine 소개
- W-TinyLFU 알고리즘 — LRU/LFU의 장점 결합
- Caffeine vs Guava Cache 비교
- 적합한 사용 사례 (단일 서버, 빠른 응답 요구)

### 기본 설정
- `spring-boot-starter-cache` + `com.github.ben-manes.caffeine:caffeine`
- `spring.cache.caffeine.spec` 설정 문자열
- `CaffeineSpec` 옵션: `maximumSize`, `expireAfterWrite`, `expireAfterAccess`, `refreshAfterWrite`

### 캐시별 개별 설정
- `CaffeineCacheManager` 직접 빈 등록
- `Caffeine.newBuilder()` per-cache 설정
- `CacheLoader` — 자동 리로드 (`refreshAfterWrite`)

### 통계 수집
- `recordStats()` 활성화
- `CacheStats` — hitCount, missCount, loadSuccessCount
- Micrometer 통합 메트릭 (`cache.gets`, `cache.size`)

---

## 6. Redis 캐시 (분산 캐시)

### RedisCacheManager 설정
- `spring-boot-starter-data-redis` + `spring-boot-starter-cache`
- `RedisCacheConfiguration` — 기본 TTL, 직렬화, 키 prefix
- `RedisCacheManager.builder()` 구성

### 직렬화 전략
- 기본 `JdkSerializationRedisSerializer` — 호환성 문제
- `GenericJackson2JsonRedisSerializer` — 타입 정보 포함 JSON
- `Jackson2JsonRedisSerializer` — 타입 고정 JSON (더 빠름)
- 직렬화 버전 불일치 문제와 해결 방법

### 캐시별 TTL 설정
- `RedisCacheManagerBuilderCustomizer`
- `withInitialCacheConfigurations()` — 캐시별 개별 설정
- 동적 TTL 설정 패턴

### 키 네임스페이스
- `computePrefixWith()` — 캐시 이름 prefix 전략
- 애플리케이션 버전 포함 키 설계
- 멀티 테넌트 환경에서의 키 분리

### Redis 캐시 운영
- `KEYS`, `SCAN` 명령어로 캐시 확인
- TTL 만료 이벤트 (`notify-keyspace-events`)
- Redis Cluster 환경에서의 캐시 주의사항

---

## 7. 캐시 동기화 & 일관성

### 캐시 스탬피드 (Cache Stampede) 문제
- 동시에 캐시 미스 발생 시 DB 과부하
- `@Cacheable(sync = true)` — Spring 4.3+
- 분산 환경에서의 한계와 Redis 분산 락 패턴
- Caffeine의 `refreshAfterWrite` 활용

### 캐시 무효화 전략
- TTL 기반 자동 만료
- 이벤트 기반 명시적 제거 (`@CacheEvict`)
- `@TransactionalEventListener`와 조합 — 트랜잭션 커밋 후 제거
- Write-Through vs Write-Behind vs Cache-Aside 패턴

### 분산 환경 일관성
- 다중 인스턴스에서 로컬 캐시 무효화 문제
- Redis Pub/Sub을 이용한 로컬 캐시 동기화
- 2-Tier 캐시 (Caffeine + Redis) 아키텍처
- 이벤트 기반 캐시 동기화 구현

---

## 8. 프로그래밍 방식 캐시 제어

### CacheManager & Cache API
- `CacheManager.getCache(name)` — 캐시 인스턴스 직접 획득
- `Cache.get(key)` / `Cache.put(key, value)` / `Cache.evict(key)`
- `Cache.get(key, Callable)` — 캐시 미스 시 로더 실행
- `Cache.putIfAbsent(key, value)`

### 사용 사례
- 어노테이션 사용이 어려운 동적 키 처리
- 배치 처리에서의 캐시 제어
- 캐시 워밍(Cache Warming) 구현
- 애플리케이션 시작 시 캐시 사전 로드 (`ApplicationRunner`)

---

## 9. 자기 호출(Self-Invocation) 문제

### 문제 원인
- Spring AOP 프록시 기반 캐시 동작 원리
- 같은 빈 내부 메서드 호출 시 프록시 우회
- `@Cacheable` 메서드가 동일 클래스의 다른 메서드에서 호출되는 경우

### 해결 방법
- 별도 빈으로 분리 (가장 권장)
- `ApplicationContext`에서 자기 자신 빈 획득 (안티패턴)
- `AopContext.currentProxy()` 활용
- AspectJ 위빙으로 전환 (컴파일/로드 타임)

---

## 10. 테스트

### 캐시 테스트 전략
- `@SpringBootTest` vs `@DataCacheTest` (없음 — 직접 구성 필요)
- 테스트에서 `ConcurrentMapCacheManager` 사용
- 캐시 히트/미스 검증 방법 (호출 횟수 검증)

### MockitoExtension + 캐시
- `CacheManager` 모킹
- `@MockBean CacheManager`로 캐시 비활성화
- `@Cacheable` 어노테이션 동작 자체 테스트

### 캐시 초기화
- `@DirtiesContext` — 테스트 간 컨텍스트 재생성 (느림)
- 각 테스트에서 `CacheManager.getCache(name).clear()`
- `@BeforeEach`에서 캐시 수동 초기화

### Testcontainers + Redis
- `@ServiceConnection`으로 Redis 컨테이너 자동 연결
- 실제 Redis 캐시 통합 테스트
- TTL 동작 검증

---

## 11. 모니터링 & 운영

### Micrometer 메트릭 자동 수집
- `cache.gets` (tags: name, cacheManager, result=hit/miss/pending)
- `cache.puts`
- `cache.evictions`
- `cache.size`
- Prometheus 쿼리 예시: 히트율 계산

### Actuator `/actuator/caches`
- 등록된 캐시 목록 조회
- `DELETE /actuator/caches/{name}` — 특정 캐시 전체 제거
- 캐시 상태 모니터링 대시보드

### 캐시 히트율 목표 설정
- 적정 TTL 결정 기준
- 캐시 크기(maximumSize) 튜닝
- 히트율 저하 알람 설정

---

## 12. 고급 패턴

### 2-Tier 캐시 (로컬 + 분산)
- Caffeine(L1) + Redis(L2) 조합 아키텍처
- `CompositeCacheManager` 구성
- 캐시 계층 간 데이터 흐름
- L1 만료 후 L2 조회 패턴 구현

### 조건부 캐시 무효화
- 비즈니스 로직 기반 `condition` / `unless` 조합
- 사용자 역할에 따른 캐시 분리
- 멀티 테넌트 캐시 키 설계

### 캐시 웜업 (Cache Warming)
- `ApplicationRunner` / `CommandLineRunner`로 시작 시 사전 로드
- 배포 후 콜드 스타트 문제 완화
- 점진적 캐시 워밍 전략

### 커스텀 CacheManager 구현
- `AbstractCacheManager` 상속
- 동적 캐시 생성 (`allowNullValues`, `createMissingCache`)
- 캐시 이름 기반 설정 자동 적용 패턴

---

## 13. JSR-107 (JCache) 통합

### JCache 어노테이션
- `@javax.cache.annotation.CacheResult` (= `@Cacheable`)
- `@CachePut` / `@CacheRemove` / `@CacheRemoveAll`
- Spring Cache 어노테이션과의 차이점
- 상호 운용성 — 같은 캐시를 양쪽에서 접근

### JCache 구현체 연동
- EhCache 3.x (JCache 지원)
- Hazelcast
- Infinispan
- `JCacheCacheManager` 설정

---

## 14. 실전 예제 & 베스트 프랙티스

### 자주 쓰이는 패턴
- 사용자 프로필 캐싱 (TTL: 5분)
- 상품 목록/상세 캐싱 (TTL: 1시간)
- 권한/역할 캐싱 (TTL: 10분)
- API 응답 캐싱 (외부 서비스 장애 대비)
- 설정값 캐싱 (DB 조회 최소화)

### 캐시 설계 원칙
- 캐시 키는 의미 있고 고유해야 한다
- `null` 값 캐싱 여부 결정 (`allowNullValues`)
- 직렬화 가능한 Value 객체 설계 (Redis 캐시 시 필수)
- 캐시 의존성이 없는 비즈니스 로직 작성

### 주의할 안티패턴
- 트랜잭션 내부에서 `@CacheEvict` (커밋 전 제거 위험)
- 변경이 잦은 데이터 캐싱 (일관성 문제)
- 캐시 크기 무한 허용 (OOM 위험)
- 너무 긴 TTL (stale 데이터 노출)
- `@Cacheable`과 `@Transactional` 순서 혼동
