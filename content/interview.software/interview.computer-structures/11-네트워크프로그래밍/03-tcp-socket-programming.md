---
title: "TCP 소켓 프로그래밍: socket, bind, listen, accept, connect"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "network", "tcp", "socket", "csapp"]
---

## TCP 소켓 프로그래밍

서버와 클라이언트가 TCP로 통신하는 전체 흐름을 시스템 콜 수준에서 이해합니다.

---

## 1. 전체 흐름

```
서버                              클라이언트
socket()                          socket()
bind()
listen()
accept() ─── 블로킹 대기 ──────→ connect()
             연결 수립!           
read() ←──────────────────────── write()
write() ─────────────────────→  read()
close()                          close()
```

---

## 2. 서버 시스템 콜

### socket()
```c
int sockfd = socket(AF_INET,      // 주소 체계 (IPv4)
                    SOCK_STREAM,  // 소켓 종류 (TCP)
                    0);           // 프로토콜 (자동 선택)
// 반환: 소켓 파일 디스크립터
```

### bind()
```c
struct sockaddr_in addr;
memset(&addr, 0, sizeof(addr));
addr.sin_family = AF_INET;
addr.sin_port = htons(8080);
addr.sin_addr.s_addr = INADDR_ANY; // 모든 인터페이스

int ret = bind(sockfd,
               (struct sockaddr *)&addr,
               sizeof(addr));
// 소켓에 주소(IP:Port) 할당
// SO_REUSEADDR 옵션 설정 권장:
setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &(int){1}, sizeof(int));
```

### listen()
```c
int ret = listen(sockfd, 128); // backlog: 대기 큐 크기
// 소켓을 수동 대기 모드로 전환
// backlog: 완료/미완료 연결 큐의 합산 한계
```

### accept()
```c
struct sockaddr_in client_addr;
socklen_t addr_len = sizeof(client_addr);

int connfd = accept(sockfd,
                    (struct sockaddr *)&client_addr,
                    &addr_len);
// 블로킹: 클라이언트 연결이 올 때까지 대기
// 반환: 연결된 소켓 FD (새 FD!)
// sockfd는 계속 리스닝, connfd로 통신
```

---

## 3. 클라이언트 시스템 콜

### connect()
```c
struct sockaddr_in server_addr;
server_addr.sin_family = AF_INET;
server_addr.sin_port = htons(8080);
inet_pton(AF_INET, "127.0.0.1", &server_addr.sin_addr);

int ret = connect(sockfd,
                  (struct sockaddr *)&server_addr,
                  sizeof(server_addr));
// TCP 3-Way Handshake 수행
// 완료되면 통신 가능
```

---

## 4. 완성된 에코 서버 예제

```c
// 서버
int main() {
    int listenfd = socket(AF_INET, SOCK_STREAM, 0);
    setsockopt(listenfd, SOL_SOCKET, SO_REUSEADDR, &(int){1}, 4);
    
    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons(8080),
        .sin_addr.s_addr = INADDR_ANY
    };
    bind(listenfd, (struct sockaddr *)&addr, sizeof(addr));
    listen(listenfd, 128);
    
    while (1) {
        struct sockaddr_in client;
        socklen_t len = sizeof(client);
        int connfd = accept(listenfd, (struct sockaddr *)&client, &len);
        
        char buf[4096];
        ssize_t n;
        while ((n = read(connfd, buf, sizeof(buf))) > 0) {
            write(connfd, buf, n); // 에코 (받은 것 그대로 돌려줌)
        }
        close(connfd);
    }
}

// 클라이언트
int main() {
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    
    struct sockaddr_in server = {
        .sin_family = AF_INET,
        .sin_port = htons(8080)
    };
    inet_pton(AF_INET, "127.0.0.1", &server.sin_addr);
    connect(sockfd, (struct sockaddr *)&server, sizeof(server));
    
    write(sockfd, "Hello", 5);
    char buf[6] = {0};
    read(sockfd, buf, 5);
    printf("서버 응답: %s\n", buf);
    close(sockfd);
}
```

---

## 5. 리스닝 소켓 vs 연결 소켓

```
핵심 구분:

리스닝 소켓 (listenfd):
  bind + listen으로 설정
  서버 포트에 고정
  accept()가 새 연결 소켓 반환
  서버 종료까지 살아있음

연결 소켓 (connfd):
  accept()가 반환
  특정 클라이언트와 1:1 대응
  실제 통신에 사용
  해당 클라이언트와 통신 끝나면 close()

서버 소켓 쌍:
  리스닝: *.8080 (모든 IP의 8080)
  연결:   10.0.0.1:54321 ↔ 10.0.0.2:8080 (특정 클라이언트)
```

---

## 6. 소켓 옵션

```c
// SO_REUSEADDR: TIME_WAIT 상태의 포트 재사용
// (서버 재시작 시 "Address already in use" 방지)
setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &(int){1}, sizeof(int));

// TCP_NODELAY: Nagle 알고리즘 비활성화
// (소량 데이터를 즉시 전송, 레이턴시 감소)
setsockopt(sockfd, IPPROTO_TCP, TCP_NODELAY, &(int){1}, sizeof(int));

// SO_KEEPALIVE: 주기적으로 생존 확인 패킷 전송
setsockopt(sockfd, SOL_SOCKET, SO_KEEPALIVE, &(int){1}, sizeof(int));

// SO_RCVBUF, SO_SNDBUF: 수신/송신 버퍼 크기
int bufsize = 1024 * 1024; // 1MB
setsockopt(sockfd, SOL_SOCKET, SO_RCVBUF, &bufsize, sizeof(bufsize));
```

---

## 핵심 요약

- **서버**: socket → bind → listen → accept(루프) → read/write → close.
- **클라이언트**: socket → connect → write/read → close.
- **accept()**: 블로킹. 새 클라이언트마다 새 connfd 반환.
- **리스닝 소켓**: 서버 포트 고정. **연결 소켓**: 클라이언트 1:1.
- **SO_REUSEADDR**: 서버 재시작 시 포트 바로 재사용 가능.
