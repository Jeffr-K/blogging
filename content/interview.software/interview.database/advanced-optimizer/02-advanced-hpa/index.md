---
title: "[Series] Advanced HPA: 고가용성과 초고성능 아키텍처"
author: jeffrey
date: 2026-04-07
tags: ["db-ha", "high-availability", "performance", "sharding", "replication", "failover"]
---

## Advanced HPA: High Performance & Availability

단일 데이터베이스의 처리량(Throughput) 한계와 장애는 무정지 서비스를 지향하는 아키텍트의 최대 적입니다. **Advanced HPA** 시리즈는 데이터베이스를 물리적으로 확장(Scale-out)하고, 어떤 상황에서도 서비스 불능 상태에 빠지지 않도록 하는 인프라적 설계 기술을 연구합니다.

---

## 📚 심화 연구 주제

### 1. 물리적 복제와 고가용성 (Replication & HA)
- **Statement vs Row-Based Replication**: 복제 방식에 따른 데이터 무결성과 지연 시간의 트레이드오프.
- **Failover & VIP Manager**: 마스터 장애 시 수초 내에 슬레이브를 마스터로 승격시키는 무중단 전환 전략.
- **Async vs Sync Replication**: 복제 정합성 보장 수준과 응답 속도의 기술적 결합 방식.

### 2. 수평적 확장과 분산 (Sharding)
- **Shard-Key 선정 전략**: 핫스팟(Hotspot) 방지 및 데이터 쏠림 현상을 차단하는 수학적 방법.
- **Range vs Lookup vs Hash Sharding**: 비즈니스 성격에 따른 물리적 데이터 분산 모델의 선택.
- **Global Table & Local Transaction**: 샤딩된 DB 간의 결합을 최소화하는 모델링 기법.

### 3. 읽기 최적화 및 CQRS 아키텍처
- **Read-Write Splitting**: 프록시(Proxy)를 이용한 부하 분산과 애플리케이션 투명성 확보.
- **Replication Lag 대응**: 복제 지연 시간(Lag)이 발생했을 때 애플리케이션에서 읽기 일관성을 지키는 아키텍처.
- **Secondary Index vs External Index (ES)**: DB 인덱스의 한계를 넘어서는 전문 검색 엔진과의 하이브리드 구성.

### 4. 물리적 지표와 성능 지표 (Throughput)
- **Transaction TPS(Transactions Per Second) & Latency**: 처리량과 속도라는 두 지표의 상관관계 분석.
- **Resource Monitoring**: CPU, Disk I/O, Network I/O의 병목 임계점 포착 기술.

이 시리즈를 통해 대규모 트래픽 앞에서도 흔들리지 않는, 거대 시스템의 데이터 근간을 설계하는 아키텍처 역량을 확보합니다.
