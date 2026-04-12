---
title: "소켓 (Socket): IP 주소와 포트 번호"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "network", "socket", "csapp"]
---

## 소켓 (Socket)

프로세스가 네트워크를 통해 통신하기 위한 **양방향 통신 끝점**입니다.

---

## 1. 소켓의 개념

```
소켓 = 네트워크 연결의 한쪽 끝점
  파일 디스크립터로 표현
  read()/write()로 데이터 송수신

소켓 주소 (IP:Port):
  인터넷에서 프로세스를 유일하게 식별
  예: 192.168.1.1:80 (IP 주소 + 포트 번호)

소켓 쌍 (Socket Pair):
  TCP 연결을 고유하게 식별
  (클라이언트IP:클라이언트포트, 서버IP:서버포트)
  예: (10.0.0.1:54321, 93.184.216.34:80)
```

---

## 2. 소켓 주소 구조체

```c
#include <netinet/in.h>

// IPv4 소켓 주소
struct sockaddr_in {
    sa_family_t sin_family; // AF_INET (항상)
    in_port_t   sin_port;   // 포트 (네트워크 바이트 순서)
    struct in_addr sin_addr; // IP 주소
};

struct in_addr {
    uint32_t s_addr; // IPv4 주소 (네트워크 바이트 순서)
};

// 범용 소켓 주소 (함수 매개변수용)
struct sockaddr {
    sa_family_t sa_family;
    char        sa_data[14];
};

// 사용 예:
struct sockaddr_in addr;
addr.sin_family = AF_INET;
addr.sin_port = htons(8080);          // 호스트→네트워크 바이트 순서
addr.sin_addr.s_addr = INADDR_ANY;    // 모든 인터페이스
// 또는:
inet_pton(AF_INET, "192.168.1.1", &addr.sin_addr); // 문자열→바이너리
```

---

## 3. 바이트 순서 (Byte Order)

```
빅 엔디안 (Big Endian) = 네트워크 바이트 순서:
  0x1234 → [0x12][0x34] (높은 바이트 먼저)
  네트워크 프로토콜 표준

리틀 엔디안 (Little Endian) = x86 호스트 바이트 순서:
  0x1234 → [0x34][0x12] (낮은 바이트 먼저)

변환 함수:
  htons(x): 16비트 호스트→네트워크 (host to network short)
  htonl(x): 32비트 호스트→네트워크 (host to network long)
  ntohs(x): 16비트 네트워크→호스트
  ntohl(x): 32비트 네트워크→호스트

규칙:
  포트, IP 주소를 소켓에 설정할 때 반드시 htons/htonl 사용!
  printf로 출력할 때는 ntohs/ntohl로 변환
```

---

## 4. 소켓 종류

```
스트림 소켓 (SOCK_STREAM):
  TCP 사용
  신뢰성 있는 연결 지향 바이트 스트림
  순서 보장, 중복 없음
  예: HTTP, SSH, FTP

데이터그램 소켓 (SOCK_DGRAM):
  UDP 사용
  비연결, 신뢰성 없음
  빠름, 오버헤드 적음
  예: DNS, 게임, 동영상 스트리밍

원시 소켓 (SOCK_RAW):
  IP 레이어 직접 접근
  커스텀 프로토콜 구현, 패킷 분석
  루트 권한 필요
  예: ping (ICMP), 네트워크 스캐너
```

---

## 5. IP 주소 변환 함수

```c
// 문자열 ↔ 바이너리 변환 (현대적 방식)
#include <arpa/inet.h>

// 문자열 → 바이너리 (pton = presentation to network)
int inet_pton(int af, const char *src, void *dst);
inet_pton(AF_INET, "192.168.1.1", &addr.sin_addr);

// 바이너리 → 문자열 (ntop = network to presentation)
const char *inet_ntop(int af, const void *src, char *dst, socklen_t size);
char ipstr[INET_ADDRSTRLEN]; // 16바이트
inet_ntop(AF_INET, &addr.sin_addr, ipstr, sizeof(ipstr));

// 도메인 이름 → IP 주소 (DNS 조회)
#include <netdb.h>
struct addrinfo hints, *res;
memset(&hints, 0, sizeof(hints));
hints.ai_family = AF_UNSPEC;     // IPv4 또는 IPv6
hints.ai_socktype = SOCK_STREAM;

getaddrinfo("www.google.com", "80", &hints, &res);
// res에 소켓 주소 구조체 목록
freeaddrinfo(res);
```

---

## 핵심 요약

- **소켓**: 네트워크 통신의 끝점. 파일 디스크립터로 표현.
- **소켓 주소**: IP:Port 쌍으로 프로세스를 전 세계에서 유일하게 식별.
- **바이트 순서**: 네트워크는 빅 엔디안. `htons/htonl`로 반드시 변환.
- **SOCK_STREAM**: TCP (신뢰성). **SOCK_DGRAM**: UDP (빠름).
- **getaddrinfo()**: 도메인 이름 → IP 주소 변환 (DNS 조회).
