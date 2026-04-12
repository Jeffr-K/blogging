---
title: "멜트다운(Meltdown)과 스펙터(Spectre): 투기적 실행의 보안 취약점"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "security", "meltdown", "spectre", "speculative-execution", "side-channel", "csapp"]
---

## 멜트다운과 스펙터

2018년 1월 공개된 멜트다운(Meltdown)과 스펙터(Spectre)는 현대 CPU의 **투기적 실행(Speculative Execution)**과 **분기 예측(Branch Prediction)** 기능을 악용한 **사이드 채널 공격(Side-Channel Attack)**입니다. 30년간 쌓아온 CPU 최적화 기법에 근본적인 보안 결함이 있음이 밝혀졌습니다.

---

## 1. 사이드 채널 공격 (Side-Channel Attack)

**직접적인 접근 없이, 시스템의 부수적인 정보(시간, 전력, 전자기 신호)를 통해 비밀 정보를 추측**하는 공격 기법입니다.

핵심 채널: **타이밍(Timing)**
- 캐시 히트: ~4ns 접근
- 캐시 미스: ~60ns 접근
- 이 차이로 특정 메모리가 캐시에 있는지 없는지 알 수 있습니다.

---

## 2. 멜트다운 (Meltdown, CVE-2017-5754)

### 2.1 공격 원리

**커널 메모리를 유저 프로세스가 읽는 공격**입니다.

일반적으로 유저 프로세스가 커널 메모리를 읽으면 **SIGSEGV(세그멘테이션 폴트)**가 발생합니다. 그런데...

```c
// 개념적 공격 코드 (실제로는 어셈블리)
char probe_array[256 * 4096];  // 캐시 탐지용 배열

// 1. 커널 메모리에서 비밀 바이트 읽기 (투기적 실행!)
char secret = kernel_address[0];  // 보안 예외 발생 → "투기적으로" 실행됨

// 2. 비밀 바이트로 probe_array 인덱스 접근 (캐시에 올림)
probe_array[secret * 4096] += 1;  // 투기적으로 실행 → 캐시 상태 변경!

// 예외 처리 (segfault 복구)
// ...

// 3. probe_array를 스캔하여 어느 인덱스가 캐시에 있는지 확인 (FLUSH+RELOAD)
for (int i = 0; i < 256; i++) {
    auto t1 = rdtsc();
    access(probe_array[i * 4096]);
    auto t2 = rdtsc();
    if (t2 - t1 < THRESHOLD) {
        // 이 인덱스가 캐시에 있음 → secret == i
        printf("secret byte: %d\n", i);
    }
}
```

### 2.2 왜 가능한가?

1. CPU가 권한 검사 전에 **투기적으로** 커널 메모리를 읽음
2. 투기적 실행 결과는 **아키텍처 상태에 반영되지 않음** (레지스터 값 보존됨)
3. 그러나 **캐시 상태는 변경됨** (사이드 채널!)
4. 권한 위반으로 예외 발생, 투기적 결과 롤백
5. 공격자가 캐시 타이밍을 측정하여 비밀 바이트 추론

### 2.3 영향 범위

- Intel CPU의 대부분 (2010년 이후)
- 일부 ARM CPU
- AMD CPU는 영향 없음 (다른 투기 실행 구현)

### 2.4 패치: KPTI (Kernel Page-Table Isolation)

유저 모드에서는 커널 메모리를 페이지 테이블에서 제거합니다.

```
KPTI 이전:
유저 페이지 테이블 = 유저 메모리 + 커널 메모리 (읽기 불가이지만 맵됨)

KPTI 이후:
유저 페이지 테이블 = 유저 메모리만 (커널 메모리 완전 제거)
→ 커널 메모리는 애초에 주소 공간에 없어서 접근 자체 불가

성능 영향: 시스템 콜/인터럽트 시 TLB 플러시 필요
→ 5~30% 성능 저하 (I/O 집약적 워크로드)
```

---

## 3. 스펙터 (Spectre, CVE-2017-5753, CVE-2017-5715)

### 3.1 멜트다운과의 차이

| | 멜트다운 | 스펙터 |
|--|---------|-------|
| 공격 대상 | 커널 메모리 | 동일 프로세스 내 또는 다른 프로세스 |
| 원리 | 권한 위반 + 투기 실행 | 분기 예측기 오염 + 투기 실행 |
| 패치 | 상대적으로 쉬움 (KPTI) | 근본적 해결 어려움 |

### 3.2 스펙터 Variant 1: 경계 검사 우회 (Bounds Check Bypass)

```c
// 피해자 코드 (정상적인 bounds check)
if (untrusted_index < array1_size) {
    uint8_t val = array1[untrusted_index];  // 범위 내라면 OK
    temp = array2[val * 256];               // array2 접근
}
```

공격자가 `untrusted_index`를 미리 여러 번 범위 내 값으로 보내 분기 예측기를 "항상 true"로 학습시킨 후, 범위 밖 값을 보내면:

1. 분기 예측기가 "if 조건 true" 예측
2. 투기적으로 `array1[범위_밖_주소]` 읽기 (비밀 바이트!)
3. 해당 비밀 바이트로 `array2` 인덱싱 → 캐시에 올라감
4. 실제로는 bounds check 실패 → 롤백
5. 공격자가 `array2` 스캔으로 비밀 바이트 추론

### 3.3 스펙터 패치

```c
// 패치 방법 1: 배리어(Barrier) 삽입
if (untrusted_index < array1_size) {
    lfence();  // 투기적 실행 방지 명령어 (Intel)
    uint8_t val = array1[untrusted_index];
    ...
}

// 패치 방법 2: 인덱스 마스킹
uint32_t safe_index = untrusted_index & mask;  // 항상 범위 내
uint8_t val = array1[safe_index];
```

---

## 4. 파급 효과

```
발견 당시 영향:
- Intel, AMD, ARM 기반 거의 모든 CPU
- 클라우드 VM 격리 약화 (같은 물리 서버의 다른 VM 공격 가능)
- 브라우저 JavaScript를 통한 웹 공격 가능성

성능 패치 비용:
- 서버 워크로드: 5~30% 성능 저하
- Intel SSD 컨트롤러: ~35% 저하
- 클라우드 비용 증가 추정: 연간 수십억 달러
```

---

## 5. 근본적 교훈

```
성능 vs 보안의 트레이드오프:
- 투기적 실행 = CPU 성능의 핵심 (수십 년간 발전)
- 그러나 "보이지 않아야 할" 사이드 채널을 노출
- 근본적 해결: 투기적 실행을 제거하면 성능 대폭 하락

하드웨어 수준 완화 (Intel Ice Lake 이후):
- eIBRS (Enhanced Indirect Branch Restricted Speculation)
- 마이크로코드 업데이트로 일부 Spectre 변형 차단
```

---

## 핵심 요약

- **멜트다운**: 투기적 실행으로 커널 메모리를 유저 공간에서 읽는 공격. KPTI 패치로 완화.
- **스펙터**: 분기 예측기를 훈련시켜 투기적으로 경계 밖 메모리 읽기. 근본적 패치 어려움.
- **사이드 채널**: 캐시 타이밍 차이(4ns vs 60ns)가 비밀 바이트를 누설.
- **교훈**: CPU 최적화 기능도 보안 측면에서 취약점이 될 수 있다. 하드웨어 설계 시 보안을 처음부터 고려해야 한다.
