---
title: "[Redis] 10. Geospatial — 위치 기반 서비스"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "geospatial", "GEOADD", "GEORADIUS", "위치기반", "근처검색"]
---

# Geospatial — 위치 기반 서비스

## 개요

Redis Geospatial은 위경도 기반 위치 인덱스. 내부적으로 Sorted Set에 geohash로 저장. 거리 계산, 반경 검색 지원.

범위 제약: 위도 -85.05112878 ~ 85.05112878 (극지방 미지원).

---

## 명령어

### 위치 추가

```bash
# GEOADD key [NX | XX] [CH] longitude latitude member
GEOADD stores 127.0276 37.4979 "gangnam-store"
GEOADD stores 126.9780 37.5665 "jongno-store"
GEOADD stores 127.1058 37.4010 "bundang-store"

# 여러 위치 동시 추가
GEOADD stores \
  127.0276 37.4979 "gangnam" \
  126.9780 37.5665 "jongno" \
  127.1058 37.4010 "bundang"

# NX: 없는 멤버만 추가
# XX: 있는 멤버만 업데이트
# CH: 추가된 수가 아닌 변경된 수 반환
```

### 위치 조회

```bash
# 위경도 조회
GEOPOS stores "gangnam"
# → [[127.02760010957717896, 37.49790022600553794]]

# 여러 위치 동시 조회
GEOPOS stores "gangnam" "jongno" "bundang"

# Geohash 조회 (문자열 해시)
GEOHASH stores "gangnam"           # "wydm9tth0r0" (11자리 base32)
GEOHASH stores "gangnam" "jongno"
```

### 거리 계산

```bash
# GEODIST key member1 member2 [m | km | mi | ft]
GEODIST stores "gangnam" "jongno" km    # 약 11.7km
GEODIST stores "gangnam" "jongno" m     # 미터
GEODIST stores "gangnam" "jongno" mi    # 마일
```

### 반경 검색

#### GEOSEARCH (Redis 6.2+, 권장)

```bash
# GEOSEARCH key FROMMEMBER member | FROMLONLAT lon lat
#   BYRADIUS radius m|km|mi|ft | BYBOX width height m|km|mi|ft
#   [ASC | DESC] [COUNT count [ANY]]
#   [WITHCOORD] [WITHDIST] [WITHCOORD]

# 특정 멤버 기준 반경 검색
GEOSEARCH stores FROMMEMBER "gangnam" BYRADIUS 5 km ASC
GEOSEARCH stores FROMMEMBER "gangnam" BYRADIUS 5 km ASC COUNT 10
GEOSEARCH stores FROMMEMBER "gangnam" BYRADIUS 5 km ASC WITHDIST WITHCOORD

# 좌표 기준 반경 검색
GEOSEARCH stores FROMLONLAT 127.0 37.5 BYRADIUS 5 km ASC

# 박스 검색 (가로 10km, 세로 10km)
GEOSEARCH stores FROMLONLAT 127.0 37.5 BYBOX 10 10 km ASC

# 결과를 다른 키에 저장
GEOSEARCHSTORE destination stores FROMLONLAT 127.0 37.5 BYRADIUS 5 km ASC
```

#### GEORADIUS (레거시, 6.2 이전)

```bash
# GEORADIUS key longitude latitude radius m|km|mi|ft
GEORADIUS stores 127.0 37.5 5 km
GEORADIUS stores 127.0 37.5 5 km ASC COUNT 10 WITHDIST WITHCOORD

# 멤버 기준
GEORADIUSBYMEMBER stores "gangnam" 5 km ASC
```

### 삭제

```bash
# Geospatial은 내부적으로 ZSet → ZREM으로 삭제
ZREM stores "gangnam"
```

---

## 활용 패턴

### 근처 매장 찾기

```kotlin
// Kotlin + Lettuce/RedisTemplate
fun findNearbyStores(
    longitude: Double,
    latitude: Double,
    radiusKm: Double,
    limit: Int = 10,
): List<StoreWithDistance> {
    val results = redis.geosearch(
        "stores",
        GeoSearchArgs.Builder
            .fromCoordinates(longitude, latitude)
            .byRadius(radiusKm, GeoUnit.KILOMETERS)
            .orderAscending()
            .count(limit)
            .withDistance()
            .withCoordinates()
    )

    return results.map { result ->
        StoreWithDistance(
            storeId = result.member,
            distanceKm = result.distance,
            lat = result.point.y,
            lon = result.point.x,
        )
    }
}
```

### 배달 라이더 위치 실시간 추적

```bash
# 라이더 위치 업데이트 (주기적으로)
GEOADD riders 127.0276 37.4979 "rider-001"
GEOADD riders 127.0100 37.5100 "rider-002"

# 고객 위치에서 가장 가까운 라이더 3명
GEOSEARCH riders FROMLONLAT 127.03 37.50 BYRADIUS 3 km ASC COUNT 3 WITHDIST

# 라이더가 배달 완료 후 제거
ZREM riders "rider-001"
```

### 지오펜싱 (Geofencing)

```bash
# 특정 지점에서 100m 이내 진입 감지
GEOSEARCH zones FROMLONLAT 127.0276 37.4979 BYRADIUS 0.1 km ASC
# 결과가 있으면 특정 존에 진입한 것
```

### 사용자 위치 기반 서비스

```bash
# 사용자 현재 위치 저장
GEOADD user-locations 127.03 37.50 "user-1001"
EXPIRE user-locations 3600  # 1시간 TTL

# 나와 같은 지역에 있는 다른 사용자
GEOSEARCH user-locations FROMMEMBER "user-1001" BYRADIUS 1 km ASC COUNT 20
```

---

## Geospatial 제약과 팁

```
정밀도:
  Redis Geohash는 52비트 정수 → 약 0.6mm 오차
  실용적으로 충분한 정밀도

확장성:
  Geospatial은 내부적으로 Sorted Set
  → ZSCAN, ZREM, ZCARD 등 ZSet 명령어 사용 가능
  → ZADD 불가 (geohash 계산 없이는 의미 없음)

크기 제한:
  위도 -85.05112878 ~ 85.05112878
  경도 -180 ~ 180

TTL:
  개별 위치에 TTL 불가 (키 전체에만 가능)
  만료 위치는 ZREM으로 직접 삭제
```

---

## 정리

| 명령어 | 설명 |
|--------|------|
| GEOADD | 위치 추가 |
| GEOPOS | 위경도 조회 |
| GEODIST | 두 위치 간 거리 |
| GEOHASH | Geohash 문자열 조회 |
| GEOSEARCH | 반경/박스 기반 검색 (권장) |
| GEOSEARCHSTORE | 검색 결과 저장 |
| GEORADIUS | 레거시 반경 검색 |
| ZREM | 위치 삭제 (ZSet 명령) |
