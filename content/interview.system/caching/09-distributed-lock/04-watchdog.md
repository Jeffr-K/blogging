---
title: "Watchdog 패턴: 락 자동 연장"
date: 2026-04-12
tags: [distributed-lock, watchdog, lock-renewal, redis]
---

## 문제: 작업이 TTL보다 오래 걸리면?

```
TTL = 10초로 락 획득
작업 시작: DB 처리 + 외부 API 호출 = 15초 예상

T=0:  락 획득 (TTL=10초)
T=10: TTL 만료 → 다른 서버가 락 획득
T=12: 내 작업 완료 → 남의 락을 해제하려다 실패
T=15: 두 서버가 동시에 작업 처리 → 중복!
```

TTL을 크게 설정하면 장애 시 복구가 늦고, 작게 설정하면 작업이 중간에 잘립니다.

---

## Watchdog: 주기적 락 연장

락을 보유 중인 스레드가 별도의 백그라운드 스레드(Watchdog)를 띄워 주기적으로 TTL을 연장합니다.

```python
import threading
import time
import uuid
import redis

class WatchdogLock:
    def __init__(self, redis_client, key: str, ttl: int = 30):
        self.redis = redis_client
        self.key = key
        self.ttl = ttl
        self.token = None
        self._watchdog_thread = None
        self._stop_event = threading.Event()

        # 원자적 해제 스크립트
        self._release_script = self.redis.register_script("""
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
        """)

        # 원자적 연장 스크립트
        self._renew_script = self.redis.register_script("""
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('PEXPIRE', KEYS[1], ARGV[2])
            else
                return 0
            end
        """)

    def acquire(self) -> bool:
        self.token = str(uuid.uuid4())
        acquired = self.redis.set(self.key, self.token, nx=True, ex=self.ttl)

        if acquired:
            self._start_watchdog()
        return bool(acquired)

    def _start_watchdog(self):
        """TTL의 1/3 주기로 연장"""
        renewal_interval = self.ttl / 3
        self._stop_event.clear()

        def watchdog():
            while not self._stop_event.wait(renewal_interval):
                result = self._renew_script(
                    keys=[self.key],
                    args=[self.token, self.ttl * 1000]  # PEXPIRE는 ms
                )
                if not result:
                    # 토큰 불일치 → 락이 사라짐 (외부에서 해제됨)
                    break

        self._watchdog_thread = threading.Thread(target=watchdog, daemon=True)
        self._watchdog_thread.start()

    def release(self) -> bool:
        self._stop_event.set()  # Watchdog 중지
        if self._watchdog_thread:
            self._watchdog_thread.join(timeout=1)

        result = self._release_script(keys=[self.key], args=[self.token])
        self.token = None
        return bool(result)

    def __enter__(self):
        if not self.acquire():
            raise LockAcquireError(f"락 획득 실패: {self.key}")
        return self

    def __exit__(self, *args):
        self.release()


# 사용
r = redis.Redis()
lock = WatchdogLock(r, "lock:order-processing", ttl=30)

with lock:
    # 30초 이상 걸려도 Watchdog이 자동으로 TTL 연장
    process_order()  # 50초 걸리는 작업도 안전
```

---

## Redisson의 Watchdog (Java)

Java에서는 Redisson 라이브러리가 Watchdog을 내장합니다:

```java
RLock lock = redissonClient.getLock("lock:my-resource");

try {
    // leaseTime=-1이면 Watchdog 자동 활성화 (기본 30초 TTL, 10초마다 연장)
    lock.lock();
    processOrder();
} finally {
    lock.unlock();
}

// 또는 명시적 TTL (Watchdog 없음)
boolean acquired = lock.tryLock(5, 30, TimeUnit.SECONDS);
```

Redisson의 Watchdog:
- 기본 TTL: 30초 (lockWatchdogTimeout)
- 연장 주기: TTL의 1/3 (10초마다)
- unlock() 호출 시 Watchdog 자동 종료

---

## 주의사항

```
1. 프로세스 죽으면 Watchdog도 죽음
   → TTL 이후 락 자동 해제 (정상 동작)

2. 네트워크 단절 시 연장 실패
   → TTL 이후 락 만료 → 다른 서버가 획득 가능
   → 처리 중인 작업과 중복 가능 (허용 가능한지 판단 필요)

3. 무한 작업 방지
   → Watchdog와 별도로 작업 최대 시간 제한
   → ex: 최대 5분 이상이면 강제 종료
```

---

## 핵심 요약

- TTL 딜레마: 크면 장애 복구 늦고, 작으면 작업 중 만료
- **Watchdog**: 백그라운드 스레드가 TTL의 1/3 주기로 연장
- 락 해제 시 Watchdog 즉시 중지
- **Redisson**: Java에서 Watchdog 내장 (`lock.lock()`만 하면 자동)
- 프로세스 크래시 시 Watchdog 소멸 → TTL 후 자동 만료 (안전)
