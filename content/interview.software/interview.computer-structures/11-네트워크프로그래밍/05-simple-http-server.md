---
title: "HTTP 서버의 간단한 구현 원리"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "network", "http", "server", "csapp"]
---

## 간단한 HTTP 서버 구현

소켓 API를 사용하여 HTTP 서버의 핵심 동작 원리를 구현합니다.

---

## 1. HTTP 프로토콜 기초

```
HTTP 요청 형식:
  GET /index.html HTTP/1.1\r\n
  Host: localhost:8080\r\n
  Connection: close\r\n
  \r\n
  (빈 줄: 헤더 끝)
  
  [요청 본문 - POST 등에서]

HTTP 응답 형식:
  HTTP/1.1 200 OK\r\n
  Content-Type: text/html\r\n
  Content-Length: 27\r\n
  \r\n
  <h1>Hello, World!</h1>

상태 코드:
  200 OK           - 성공
  301 Moved        - 영구 이동
  304 Not Modified - 캐시 유효
  400 Bad Request  - 잘못된 요청
  404 Not Found    - 없음
  500 Internal Error - 서버 오류
```

---

## 2. 최소 HTTP 서버 구현

```c
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>

#define PORT 8080
#define BUFSIZE 8192

void handle_request(int connfd) {
    char buf[BUFSIZE];
    ssize_t n = read(connfd, buf, sizeof(buf) - 1);
    if (n <= 0) return;
    buf[n] = '\0';
    
    // 요청 파싱: 첫 줄에서 메서드, 경로, 버전 추출
    char method[16], path[256], version[16];
    sscanf(buf, "%s %s %s", method, path, version);
    
    // 응답 생성
    const char *body = "<html><body><h1>Hello!</h1></body></html>";
    char response[BUFSIZE];
    int body_len = strlen(body);
    
    snprintf(response, sizeof(response),
        "HTTP/1.1 200 OK\r\n"
        "Content-Type: text/html\r\n"
        "Content-Length: %d\r\n"
        "Connection: close\r\n"
        "\r\n"
        "%s",
        body_len, body);
    
    write(connfd, response, strlen(response));
}

int main() {
    int listenfd = socket(AF_INET, SOCK_STREAM, 0);
    setsockopt(listenfd, SOL_SOCKET, SO_REUSEADDR, &(int){1}, 4);
    
    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons(PORT),
        .sin_addr.s_addr = INADDR_ANY
    };
    bind(listenfd, (struct sockaddr *)&addr, sizeof(addr));
    listen(listenfd, 128);
    
    printf("HTTP 서버 시작: http://localhost:%d\n", PORT);
    
    while (1) {
        int connfd = accept(listenfd, NULL, NULL);
        handle_request(connfd);
        close(connfd);
    }
}
```

---

## 3. 정적 파일 서빙

```c
void serve_file(int connfd, const char *path) {
    // 경로 정제 (디렉터리 트래버설 방지)
    if (strstr(path, "..")) {
        // 403 Forbidden
        write(connfd, "HTTP/1.1 403 Forbidden\r\n\r\n", 26);
        return;
    }
    
    // / → /index.html
    char filepath[512];
    snprintf(filepath, sizeof(filepath), "www%s",
             strcmp(path, "/") == 0 ? "/index.html" : path);
    
    FILE *fp = fopen(filepath, "rb");
    if (!fp) {
        const char *err = "HTTP/1.1 404 Not Found\r\n"
                         "Content-Length: 9\r\n\r\n"
                         "Not Found";
        write(connfd, err, strlen(err));
        return;
    }
    
    // 파일 크기
    fseek(fp, 0, SEEK_END);
    long fsize = ftell(fp);
    fseek(fp, 0, SEEK_SET);
    
    // MIME 타입 결정
    const char *mime = "text/plain";
    if (strstr(filepath, ".html")) mime = "text/html";
    else if (strstr(filepath, ".css"))  mime = "text/css";
    else if (strstr(filepath, ".js"))   mime = "application/javascript";
    else if (strstr(filepath, ".png"))  mime = "image/png";
    
    // 헤더 전송
    char header[512];
    snprintf(header, sizeof(header),
             "HTTP/1.1 200 OK\r\n"
             "Content-Type: %s\r\n"
             "Content-Length: %ld\r\n"
             "\r\n", mime, fsize);
    write(connfd, header, strlen(header));
    
    // 파일 내용 전송
    char buf[4096];
    size_t n;
    while ((n = fread(buf, 1, sizeof(buf), fp)) > 0) {
        write(connfd, buf, n);
    }
    fclose(fp);
}
```

---

## 4. 동시 처리: fork 기반

```c
while (1) {
    int connfd = accept(listenfd, NULL, NULL);
    
    pid_t pid = fork();
    if (pid == 0) {
        // 자식: 요청 처리
        close(listenfd);  // 자식은 리스닝 소켓 불필요
        handle_request(connfd);
        close(connfd);
        exit(0);
    }
    // 부모: 다음 연결 수락
    close(connfd);  // 부모는 연결 소켓 불필요
    waitpid(-1, NULL, WNOHANG); // 좀비 방지
}
```

---

## 5. Keep-Alive와 파이프라이닝

```
HTTP/1.0: 요청마다 TCP 연결 새로 수립
  connect → request → response → disconnect (매번 3-way handshake!)

HTTP/1.1 Keep-Alive (기본 활성화):
  하나의 TCP 연결로 여러 요청/응답
  Connection: keep-alive
  서버: Content-Length 또는 Transfer-Encoding 필수
  
  구현:
    while ((n = read_request(connfd, req)) > 0) {
        send_response(connfd, req);
    }

HTTP 파이프라이닝:
  응답 기다리지 않고 요청 여러 개 연속 전송
  순서 유지 필요 (HOL Blocking 문제)
  
HTTP/2 다중화:
  스트림(Stream) 개념으로 순서 없이 병렬 처리
  HOL Blocking 해결
```

---

## 6. CGI (Common Gateway Interface)

```
동적 응답 생성:
  URL 경로가 스크립트를 가리킬 때
  서버가 별도 프로세스로 스크립트 실행
  스크립트의 stdout → HTTP 응답 본문

구현:
  if (is_cgi(path)) {
      // fork + exec
      pid_t pid = fork();
      if (pid == 0) {
          dup2(connfd, STDOUT_FILENO); // 출력 → 소켓
          execve(path, args, env);     // CGI 스크립트 실행
      }
  }
  
현대: CGI 대신 FastCGI, WSGI, Rack 등 사용
```

---

## 핵심 요약

- **HTTP**: 텍스트 기반 요청/응답 프로토콜. `\r\n`으로 줄 구분, 빈 줄로 헤더 끝.
- **최소 서버**: socket → bind → listen → accept → read(요청) → write(응답).
- **정적 파일**: 경로 → 파일 열기 → MIME 타입 → 내용 전송.
- **동시성**: fork/thread/epoll 중 선택.
- **Keep-Alive**: 하나의 TCP 연결 재사용 → 성능 향상.
