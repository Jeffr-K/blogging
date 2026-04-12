---
title: "Redis Deep Dive — In-memory 아키텍처와 분산 캐싱 전략"
author: jeffrey
date: 2026-04-07
tags: ["redis", "in-memory", "caching", "single-threaded", "sentinel", "cluster"]
---

## Redis: 고성능 메모리 기반의 데이터 정수

Redis는 초당 수십만 건의 연산을 마이크로초 단위의 지연 시간으로 처리하는 인메모리 데이터 저장소입니다. 싱글 스레드 이벤트 루프의 특성과 다양한 데이터 구조를 효율적으로 활용하는 것이 고성능 서비스의 핵심입니다.

## 🔍 핵심 탐구 주제 (클로드 작업 지점)

### 1. 싱글 스레드 이벤트 루프의 물리적 한계와 성능
- **Non-blocking I/O**: 싱글 스레드가 어떻게 수만 개의 커넥션을 처리하는가 (`epoll` 메커니즘).
- **O(N) 명령의 위험성**: `KEYS`, `SMEMBERS` 등 CPU를 점유하는 명령어가 전체 시스템에 미치는 영향.

### 2. 가용성과 지속성 (Persistence)
- **RDB vs AOF**: 메모리 데이터를 디스크에 백업하는 물리적 방식의 차이와 성능 트레이드오프.
- **Sentinel & Cluster**: 자동 장애 조치(Failover)와 Hash Slot 기반의 수평적 확장 기술.

### 3. 실전 캐싱 전략과 이슈
- **Cache Aside / Write Back**: 서비스 요건에 따른 캐시 패턴 선정.
- **Thundering Herd & Cache Stampede**: 대규모 동시 요청 시 DB를 보호하는 방어 전략.

---

## 🛠️ 실무 지침
"메모리는 유한한 자원이다"라는 전제하에 **Eviction Policy(LRU, LFU)**와 **메모리 단편화** 문제를 기술적으로 깊이 있게 기고하십시오.
