---
title: "엔디안(Endianness): 빅 엔디안 vs 리틀 엔디안"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "endianness", "big-endian", "little-endian", "network", "csapp"]
---

## 엔디안(Endianness)

메모리에 다중 바이트 데이터를 저장할 때 바이트를 어떤 순서로 배치하는가를 **엔디안(Endianness)**이라 합니다. 이는 서로 다른 아키텍처 간 데이터 교환, 네트워크 프로그래밍, 파일 파싱에서 자주 만나는 개념입니다.

---

## 1. 빅 엔디안 (Big-Endian)

**최상위 바이트(MSB, Most Significant Byte)가 낮은 주소에** 저장됩니다. "사람이 읽는 순서"와 같습니다.

```
값: 0x12345678 (4바이트 정수)

주소:  0x100  0x101  0x102  0x103
값:    0x12   0x34   0x56   0x78
        ↑
       MSB (가장 큰 자리)가 낮은 주소에
```

**사용 환경**: 네트워크 바이트 순서(TCP/IP), SPARC, PowerPC, 일부 ARM, Motorola 68000.

---

## 2. 리틀 엔디안 (Little-Endian)

**최하위 바이트(LSB, Least Significant Byte)가 낮은 주소에** 저장됩니다.

```
값: 0x12345678 (4바이트 정수)

주소:  0x100  0x101  0x102  0x103
값:    0x78   0x56   0x34   0x12
        ↑
       LSB (가장 작은 자리)가 낮은 주소에
```

**사용 환경**: x86, x86-64 (Intel, AMD), 대부분의 ARM (기본 모드).

---

## 3. 내 시스템의 엔디안 확인

```c
#include <stdio.h>

int main() {
    int x = 1;  // 0x00000001
    char *p = (char *)&x;
    
    if (*p == 1) {
        printf("Little-Endian\n");  // 낮은 주소에 1(LSB)이 있음
    } else {
        printf("Big-Endian\n");
    }
    return 0;
}
```

---

## 4. 엔디안이 중요한 이유

### 4.1 네트워크 통신

TCP/IP 프로토콜은 **빅 엔디안(네트워크 바이트 순서)**을 사용합니다. x86(리틀 엔디안) 시스템에서 네트워크로 데이터를 보낼 때 변환이 필요합니다.

```c
#include <arpa/inet.h>

uint16_t port = 8080;

// 호스트 → 네트워크 바이트 순서 변환
uint16_t net_port = htons(port);  // htons: host to network short

// 네트워크 → 호스트 바이트 순서 변환
uint16_t host_port = ntohs(net_port);  // ntohs: network to host short

// 32비트 버전
uint32_t ip = htonl(0xC0A80101);  // 192.168.1.1
uint32_t host_ip = ntohl(ip);

// 함수 목록:
// htons/ntohs: host↔network, short (16비트)
// htonl/ntohl: host↔network, long (32비트)
```

### 4.2 바이너리 파일 파싱

파일 포맷마다 엔디안이 다릅니다.

```c
// BMP 파일: 리틀 엔디안
// PNG 파일: 빅 엔디안
// JPEG: 빅 엔디안

// BMP 헤더 읽기 (리틀 엔디안)
FILE *f = fopen("image.bmp", "rb");
uint32_t width, height;
fseek(f, 18, SEEK_SET);
fread(&width, 4, 1, f);   // x86에서는 그냥 읽으면 됨 (리틀 엔디안)
fread(&height, 4, 1, f);

// PNG 헤더 읽기 (빅 엔디안)
// x86에서는 바이트 순서 변환 필요
uint32_t png_width;
fread(&png_width, 4, 1, f);
png_width = ntohl(png_width);  // 변환!
```

### 4.3 크로스 플랫폼 직렬화

서로 다른 엔디안 시스템 간 데이터 교환 시 명시적 변환이 필요합니다.

```c
// 플랫폼 독립적인 직렬화: 항상 리틀 엔디안으로 저장
void write_uint32_le(FILE *f, uint32_t val) {
    uint8_t bytes[4];
    bytes[0] = val & 0xFF;
    bytes[1] = (val >> 8) & 0xFF;
    bytes[2] = (val >> 16) & 0xFF;
    bytes[3] = (val >> 24) & 0xFF;
    fwrite(bytes, 1, 4, f);
}

uint32_t read_uint32_le(FILE *f) {
    uint8_t bytes[4];
    fread(bytes, 1, 4, f);
    return bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
}
```

---

## 5. 엔디안 변환 함수 직접 구현

```c
// 16비트 바이트 스왑
uint16_t swap16(uint16_t x) {
    return (x >> 8) | (x << 8);
}

// 32비트 바이트 스왑
uint32_t swap32(uint32_t x) {
    return ((x & 0xFF000000) >> 24) |
           ((x & 0x00FF0000) >>  8) |
           ((x & 0x0000FF00) <<  8) |
           ((x & 0x000000FF) << 24);
}

// 64비트 바이트 스왑
uint64_t swap64(uint64_t x) {
    return ((x & 0xFF00000000000000ULL) >> 56) |
           ((x & 0x00FF000000000000ULL) >> 40) |
           ((x & 0x0000FF0000000000ULL) >> 24) |
           ((x & 0x000000FF00000000ULL) >>  8) |
           ((x & 0x00000000FF000000ULL) <<  8) |
           ((x & 0x0000000000FF0000ULL) << 24) |
           ((x & 0x000000000000FF00ULL) << 40) |
           ((x & 0x00000000000000FFULL) << 56);
}

// GCC 내장 함수 (더 효율적)
uint32_t fast_swap32 = __builtin_bswap32(x);
uint64_t fast_swap64 = __builtin_bswap64(x);
```

---

## 6. 디버깅 예시

```c
int x = 0xDEADBEEF;

// 메모리 덤프 (x86 리틀 엔디안)
unsigned char *p = (unsigned char *)&x;
printf("메모리 순서: ");
for (int i = 0; i < 4; i++) {
    printf("%02X ", p[i]);  // EF BE AD DE (역순!)
}
printf("\n");

// 출력: EF BE AD DE
// 0xEF = LSB, 0xDE = MSB
```

---

## 핵심 요약

| | 빅 엔디안 | 리틀 엔디안 |
|--|----------|-----------|
| MSB 위치 | 낮은 주소 | 높은 주소 |
| 사용 | 네트워크(TCP/IP), SPARC | x86, x86-64, ARM |
| 사람이 읽는 순서 | 같음 | 역순 |

- **네트워크 프로그래밍**: 항상 `htons/htonl`, `ntohs/ntohl` 사용.
- **파일 파싱**: 파일 포맷의 엔디안 명세를 확인하고 필요 시 변환.
- **이식성**: 플랫폼 독립 코드에서는 엔디안을 명시적으로 처리.
