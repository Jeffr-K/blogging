---
title: "컴퓨터 네트워크 학습 목차"
date: 2026-03-17
tags:
  - cs
  - interview
  - network
---

# 컴퓨터 네트워크 (Computer Network)

소프트웨어 엔지니어링 면접에서 '네트워크'는 웹 개발자, 백엔드 엔지니어, 인프라 엔지니어를 막론하고 가장 필수적으로 검증하는 기본기 중 하나입니다. 

컴퓨터 공학 전공 과정(하향식 Top-down 또는 상향식 Bottom-up 접근법)에서 주로 다루는 핵심 주제들을 면접에 맞게 재구성한 목차입니다.

아래 목차를 따라 순서대로 학습하거나, 부족한 부분을 찾아 복습해 보세요.

---

## 1. 네트워크 기초 모델 (Network Fundamentals)
네트워크 통신의 뼈대가 되는 계층 모델과 기본 용어를 이해합니다.

*   [OSI 7계층 (OSI 7 Layer) 모델](./osi-7-layer)
*   [TCP/IP 4계층 모델](./tcp-ip-model)
*   [캡슐화(Encapsulation)와 역캡슐화(Decapsulation)](./encapsulation)
*   [회선 교환(Circuit Switching)과 패킷 교환(Packet Switching)](./packet-switching)
*   [(심화) Zero Copy와 네트워크 I/O 성능 최적화](./zero-copy)

## 2. 물리 & 데이터 링크 계층 (Physical & Data Link Layer - L1, L2)
노드 간의 물리적인 연결과 신뢰성 있는 데이터 전송의 기초를 다룹니다.

*   [MAC 주소 (Media Access Control Address)](./mac-address)
*   [이더넷(Ethernet)과 CSMA/CD](./ethernet)
*   [허브(Hub)와 스위치(Switch)의 차이](./hub-and-switch)
*   [VLAN (Virtual LAN)의 개념과 필요성](./vlan)
*   [(심화) ARP Spoofing (ARP 스푸핑) 원리와 방어](./arp-spoofing)

## 3. 네트워크 계층 (Network Layer - L3)
서로 다른 네트워크 간의 최적의 경로(라우팅)를 찾고 데이터를 전달하는 역할을 합니다.

*   [IP 주소 (IPv4 vs IPv6) 및 NAT(Network Address Translation)](./ip-address-nat)
*   [서브네팅(Subnetting)과 CIDR](./subnetting)
*   [라우팅 알고리즘 (거리 벡터 vs 링크 상태, BGP, OSPF)](./routing)
*   [ARP (주소 결합 프로토콜)](./arp)
*   [ICMP (인터넷 제어 메시지 프로토콜 - ping, traceroute)](./icmp)
*   [(심화) IP 단편화(Fragmentation)와 MTU, MSS](./mtu-mss-fragmentation)
*   [(심화) Anycast, Multicast, Broadcast의 차이와 활용](./anycast-multicast)

## 4. 전송 계층 (Transport Layer - L4)
종단 간(End-to-End) 통신을 담당하며, 면접에서 **가장 자주 출제되는 핵심 계층**입니다.

*   [**TCP vs UDP 차이점 (매우 중요)**](./tcp-vs-udp)
*   [TCP 3-Way Handshake & 4-Way Handshake](./tcp-handshake)
*   [TCP의 흐름 제어(Flow Control)와 혼잡 제어(Congestion Control)](./tcp-control)
*   [TCP Keep-Alive와 HTTP Keep-Alive의 차이](./tcp-vs-http-keepalive)
*   [(심화) TCP TIME_WAIT 상태의 의미와 대규모 트래픽에서의 튜닝](./tcp-time-wait)
*   [(심화) TCP SYN Cookie (SYN Flooding 공격 방어)](./tcp-syn-cookie)
*   [(심화) QUIC 프로토콜 (UDP 기반의 차세대 전송 프로토콜)](./quic-protocol)

## 5. 애플리케이션 계층 (Application Layer - L7)
사용자가 직접 체감하는 웹과 애플리케이션 수준의 프로토콜입니다.

*   [HTTP와 HTTPS](./http-https)
*   [HTTP 버전별 차이 (HTTP/1.1, HTTP/2.0, HTTP/3.0)](./http-versions)
*   [DNS (도메인 네임 시스템)의 동작 원리 (Iterative vs Recursive)](./dns)
*   [**"웹 브라우저에 google.com을 치면 일어나는 일" (단골 질문)**](./what-happens-when-you-type-a-url)
*   [REST API의 개념과 설계 원칙](./rest-api)
*   [웹소켓 (WebSocket), SSE(Server-Sent Events), 폴링(Polling)](./websocket-sse)
*   [쿠키(Cookie), 세션(Session), JWT(Token)](./cookie-session-jwt)
*   [(심화) GraphQL과 gRPC (REST API의 대안)](./graphql-grpc)
*   [(심화) DNS 레코드 타입 (A, CNAME, TXT, MX, NS) 및 라우팅 정책](./dns-records)

## 6. 네트워크 보안 및 인프라 아키텍처 (Security & Architecture)
현대 웹 서비스 환경에서 트래픽을 분산하고 안전하게 보호하기 위한 기술입니다.

*   [대칭키/비대칭키 암호화와 SSL/TLS 핸드셰이크](./ssl-tls)
*   [로드 밸런서 (L4 스위치 vs L7 스위치) 및 해싱 알고리즘](./load-balancing)
*   [포워드 프록시(Forward Proxy)와 리버스 프록시(Reverse Proxy)](./proxy)
*   [CDN (Content Delivery Network)의 캐싱 전략](./cdn)
*   [CORS (교차 출처 리소스 공유)와 Preflight Request](./cors)
*   [(심화) VPN(Virtual Private Network)과 IPSec](./vpn-ipsec)
*   [(심화) OAuth 2.0과 OIDC(OpenID Connect)의 동작 흐름](./oauth2-oidc)
*   [(심화) DDoS 공격의 유형과 방어 기법 (L3/L4 vs L7)](./ddos-attack)

---

### 💡 면접 대비 팁 (Interview Tips)
*   **Top-down 학습:** 전공 서적은 1계층(물리)부터 올라가는 경우가 많지만, 실무 면접에서는 애플리케이션(L7) -> 전송(L4) -> 네트워크(L3) 순으로 **Top-down(하향식)**으로 학습하는 것이 훨씬 효율적입니다.
*   **트러블슈팅 경험 연결:** 이론적인 지식에 더해, 실제 개발 과정에서 발생했던 네트워크 이슈(예: CORS 에러 해결, 타임아웃, TIME_WAIT 소켓 고갈 등)를 이 이론들과 엮어서 설명할 수 있다면 최고의 답변이 됩니다.
*   **심화 주제 공략:** 기본기를 다진 후, (심화) 태그가 붙은 주제들을 학습하면 대규모 트래픽 처리 경험이나 시스템 최적화(튜닝) 역량을 어필하는 데 큰 도움이 됩니다.
