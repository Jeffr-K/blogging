---
title: "캐시 워밍: 콜드 스타트 방지"
date: 2026-04-12
tags: [cache, warming, cold-start, deployment]
---

## 콜드 스타트 문제

```
새 배포 또는 Redis 재시작:
  → 캐시 완전 비어있음
  → 모든 요청이 DB로 직행
  → DB 과부하 → 응답 지연 → 사용자 불만
  → 최악의 경우 Avalanche
```

---

## 캐시 워밍이란

서비스 시작 전 또는 재시작 후 중요한 데이터를 미리 캐시에 채우는 작업입니다.

---

## 방법 1: 시작 시 인기 데이터 로딩

```python
import concurrent.futures
import random

def warm_cache():
    """서비스 시작 시 인기 데이터 사전 로딩"""
    print("캐시 워밍 시작...")

    # 1. 인기 상품 (조회수 기준 상위 1만 개)
    popular_products = db.execute("""
        SELECT id FROM products
        ORDER BY view_count DESC
        LIMIT 10000
    """)

    # 병렬로 캐시 채우기
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = []
        for product in popular_products:
            futures.append(executor.submit(warm_product, product["id"]))
        concurrent.futures.wait(futures)

    # 2. 설정 데이터 (전체)
    configs = db.execute("SELECT * FROM configs")
    pipeline = redis.pipeline()
    for config in configs:
        ttl = 86400 + random.randint(-3600, 3600)  # Jitter
        pipeline.setex(f"config:{config['key']}", ttl, serialize(config))
    pipeline.execute()

    print(f"캐시 워밍 완료: 상품 {len(popular_products)}개, 설정 {len(configs)}개")

def warm_product(product_id: int):
    product = db.find_product(product_id)
    if product:
        ttl = 3600 + random.randint(-360, 360)  # Jitter
        redis.setex(f"product:{product_id}", ttl, serialize(product))
```

---

## 방법 2: 실제 트래픽 패턴으로 워밍

최근 로그를 분석해 실제로 많이 조회된 키를 워밍합니다:

```python
def warm_from_access_logs(hours: int = 24):
    """지난 N시간의 접근 로그 기반 워밍"""
    # 최근 N시간 동안 가장 많이 조회된 키 추출
    popular_keys = analytics.query(f"""
        SELECT entity_type, entity_id, COUNT(*) as hits
        FROM access_logs
        WHERE created_at > NOW() - INTERVAL {hours} HOUR
        GROUP BY entity_type, entity_id
        HAVING hits > 100
        ORDER BY hits DESC
        LIMIT 50000
    """)

    for item in popular_keys:
        if item["entity_type"] == "product":
            warm_product(item["entity_id"])
        elif item["entity_type"] == "user":
            warm_user(item["entity_id"])
```

---

## 방법 3: RDB 스냅샷 재활용

Redis가 RDB를 사용 중이라면 재시작 시 자동으로 복구됩니다:

```bash
# Redis 설정
save 900 1
save 300 10
dbfilename dump.rdb

# 재시작 시 자동으로 dump.rdb 로드
redis-server --dbfilename dump.rdb
```

**한계:** RDB는 마지막 저장 이후 변경사항이 없음 (수분~수시간 구버전)

---

## 방법 4: 배포 파이프라인에 워밍 포함

```yaml
# CI/CD 파이프라인 (GitHub Actions)
deploy:
  steps:
    - name: Deploy new version
      run: kubectl rolling-update app

    - name: Warm cache
      run: |
        # 새 파드가 뜨면 즉시 워밍
        kubectl exec deploy/app -- python manage.py warm_cache

    - name: Wait for cache warm
      run: sleep 30  # 워밍 완료 대기

    - name: Health check
      run: curl https://api.example.com/health
```

---

## 점진적 워밍 (트래픽 급증 방지)

한 번에 너무 많이 채우면 DB 부하 급증:

```python
import asyncio

async def warm_cache_gradually(items: list, batch_size: int = 100, delay: float = 0.1):
    """배치 단위로 워밍 (DB 부하 분산)"""
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        tasks = [warm_item(item) for item in batch]
        await asyncio.gather(*tasks)
        await asyncio.sleep(delay)  # 배치 사이 100ms 대기
        print(f"워밍 진행: {i + len(batch)}/{len(items)}")
```

---

## 핵심 요약

- 콜드 스타트: 캐시 비어있음 → DB 과부하 → Avalanche
- **시작 시 워밍**: 인기 데이터를 병렬로 사전 로딩
- **로그 기반 워밍**: 실제 트래픽 패턴 활용 → 효율적
- **RDB 재활용**: 수분 내의 데이터는 자동 복구
- **점진적 워밍**: 배치 + 딜레이로 DB 부하 분산
- Jitter 포함: 워밍된 키들이 동시 만료 안 되도록
