---
title: "TCP 연결의 생애주기: 3-Way Handshake와 4-Way Handshake"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "network", "tcp", "handshake", "csapp"]
---

## TCP 연결 생애주기

TCP는 **신뢰성 있는 연결 지향 프로토콜**입니다. 연결 수립과 종료 과정을 이해합니다.

---

## 1. TCP 세그먼트 헤더 핵심 필드

```
┌──────────┬──────────┐
│ 소스 포트  │ 목적지 포트│ (각 16비트)
├──────────┴──────────┤
│      시퀀스 번호      │ (32비트): 바이트 스트림 위치
├─────────────────────┤
│    확인 응답 번호     │ (32비트): 다음에 받길 기대하는 번호
├───────┬─────────────┤
│ 헤더 크기│  제어 비트  │ SYN/ACK/FIN/RST/PSH
├───────┴─────────────┤
│       윈도우 크기    │ (수신 버퍼 크기)
└─────────────────────┘

제어 비트:
  SYN: 연결 요청 (Synchronize)
  ACK: 확인 응답 (Acknowledge)
  FIN: 연결 종료 (Finish)
  RST: 연결 리셋 (Reset)
```

---

## 2. 3-Way Handshake (연결 수립)

```
클라이언트                    서버
    │                          │ LISTEN 상태
    │──── SYN (seq=x) ────────→│ SYN_RCVD
    │     "연결 요청"            │
    │                          │
    │←── SYN+ACK (seq=y, ─────│
    │     ack=x+1)              │
    │     "요청 수락, 내 seq는 y" │
    │                          │
    │──── ACK (ack=y+1) ──────→│ ESTABLISHED
    │     "확인"                │
    │  ESTABLISHED              │
    │                          │
    │←───── 데이터 교환 ────────→│

왜 3번?
  2번으로는 서버→클라이언트 방향 시퀀스 번호 동기화 불가
  클라이언트: "내 seq=x" 전송 → 서버: "확인, 내 seq=y" → 클라이언트: "확인"
  양방향 시퀀스 번호 동기화 필요 = 최소 3번
```

---

## 3. 연결 수립 후 상태

```
SYN_SENT: 클라이언트가 SYN 전송 후 대기
SYN_RCVD: 서버가 SYN 받고 SYN+ACK 전송
ESTABLISHED: 양쪽 다 연결 완료, 데이터 전송 가능
```

---

## 4. 4-Way Handshake (연결 종료)

```
클라이언트                    서버
    │ ESTABLISHED               │ ESTABLISHED
    │──── FIN (seq=u) ─────────→│ CLOSE_WAIT
    │     "나는 다 보냈어"        │ (서버는 아직 보낼 수 있음)
    │                           │
    │←─── ACK (ack=u+1) ───────│
    │     "알겠어"               │
    │  FIN_WAIT_2               │
    │                           │
    │     (서버가 남은 데이터 전송) │
    │                           │
    │←─── FIN (seq=v) ─────────│ LAST_ACK
    │     "나도 다 보냈어"        │
    │                           │
    │──── ACK (ack=v+1) ───────→│ CLOSED
    │  TIME_WAIT                │
    │  (2MSL 대기 후 CLOSED)     │

왜 4번? (3번과 차이)
  종료는 단방향: 한쪽이 FIN 보내도 상대방은 아직 보낼 데이터 있을 수 있음
  서버의 ACK와 FIN이 분리 (ACK 즉시, FIN은 데이터 다 보낸 후)
  → Half-Close: 한쪽만 닫는 것도 가능
```

---

## 5. TIME_WAIT 상태

```
왜 TIME_WAIT가 필요한가?

이유 1: 마지막 ACK 손실 대비
  서버가 FIN 보냄 → 클라이언트 ACK → ACK 손실!
  서버: ACK 못 받으면 FIN 재전송
  클라이언트가 바로 CLOSED면: RST 응답 → 서버 오류
  TIME_WAIT 동안 ACK 재전송 가능

이유 2: 낡은 세그먼트 배제
  같은 포트로 새 연결 시 이전 연결의 지연된 세그먼트 오해 방지

TIME_WAIT 기간: 2 × MSL (Maximum Segment Lifetime)
  Linux 기본: 60초 (MSL=30초)

서버 문제:
  대용량 서버에서 TIME_WAIT 소켓 수천 개 → 포트 고갈
  해결: SO_REUSEADDR, SO_LINGER, 클라이언트가 먼저 닫도록 프로토콜 설계
```

---

## 6. TCP 상태 다이어그램

```
                  CLOSED
                 /      \
          (수동 열기)  (능동 열기, SYN 전송)
               /            \
           LISTEN           SYN_SENT
               \                \
          (SYN 수신)       (SYN+ACK 수신, ACK 전송)
               \                \
           SYN_RCVD          ESTABLISHED
               /                    \
     (ACK 수신)              (FIN 전송 or 수신)
          /                    /        \
   ESTABLISHED          FIN_WAIT_1    CLOSE_WAIT
                              |              |
                         (ACK 수신)    (FIN 전송)
                              |              |
                         FIN_WAIT_2      LAST_ACK
                              |              |
                         (FIN 수신)     (ACK 수신)
                              |              |
                          TIME_WAIT        CLOSED
                              |
                         (2MSL 후)
                              |
                            CLOSED
```

---

## 7. TCP vs UDP

```
                TCP             UDP
연결 방식:     연결 지향        비연결
신뢰성:        보장 (재전송)    없음
순서 보장:     예               없음
흐름 제어:     예 (윈도우)      없음
오버헤드:      높음             낮음
속도:          느림             빠름
사용:          HTTP, SSH, DB   DNS, 게임, 스트리밍
```

---

## 핵심 요약

- **3-Way**: SYN → SYN+ACK → ACK. 양방향 시퀀스 번호 동기화.
- **4-Way**: FIN → ACK → FIN → ACK. 각 방향 독립적 종료.
- **TIME_WAIT**: 마지막 ACK 손실 대비 + 지연 세그먼트 배제. 2MSL 대기.
- **Half-Close**: 한쪽이 FIN 보내도 상대방은 계속 전송 가능.
- **SYN Flood**: SYN만 대량 전송 → SYN_RCVD 큐 고갈 (DoS 공격).
