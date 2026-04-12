---
title: "파일 시스템 콜: open, close, read, write"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "system-io", "syscall", "file", "csapp"]
---

## 파일 기본 시스템 콜

유닉스 I/O의 핵심 4개 시스템 콜입니다.

---

## 1. open()

```c
#include <fcntl.h>

int open(const char *path, int flags, mode_t mode);
// 반환: 파일 디스크립터 (실패 시 -1)

// flags (필수 1개 선택):
O_RDONLY  // 읽기 전용
O_WRONLY  // 쓰기 전용
O_RDWR    // 읽기/쓰기

// flags (선택적, OR 조합):
O_CREAT   // 없으면 새 파일 생성 (mode 필요)
O_TRUNC   // 기존 내용 삭제 후 열기
O_APPEND  // 모든 쓰기가 파일 끝에 추가
O_EXCL    // O_CREAT와 함께: 파일 이미 존재하면 실패

// 예제:
int fd = open("file.txt", O_RDONLY);
int fd = open("new.txt", O_WRONLY|O_CREAT|O_TRUNC, 0644);
int fd = open("log.txt", O_WRONLY|O_CREAT|O_APPEND, 0644);

// mode (O_CREAT 시 파일 권한):
// 0644 = rw-r--r--
// 실제 권한 = mode & ~umask
```

---

## 2. close()

```c
int close(int fd);
// 반환: 0 (성공), -1 (실패)

// 역할:
// 1. FD 테이블 항목 해제
// 2. 열린 파일 테이블 참조 카운트 감소
// 3. 카운트 = 0이면 열린 파일 테이블 항목 삭제
// 4. 아이노드 참조 카운트 감소

// 주의: 프로세스 종료 시 자동으로 모든 FD 닫힘
//       하지만 명시적으로 닫는 것이 좋은 습관

// 반환값 체크가 중요:
if (close(fd) < 0) {
    perror("close");  // NFS 등에서 오류 발생 가능
}
```

---

## 3. read()

```c
#include <unistd.h>

ssize_t read(int fd, void *buf, size_t count);
// 반환: 읽은 바이트 수, 0 (EOF), -1 (오류)

// 중요: count 바이트보다 적게 읽힐 수 있음! (Short Count)
// 발생 이유:
//   - 파일 끝에 도달 (EOF)
//   - 파이프/소켓에서 데이터 부족
//   - 시그널 인터럽트 (EINTR)
//   - 네트워크 소켓의 흐름 제어

// 안전한 읽기 (Short Count 대비):
ssize_t readn(int fd, char *buf, size_t n) {
    size_t nleft = n;
    ssize_t nread;
    while (nleft > 0) {
        nread = read(fd, buf, nleft);
        if (nread < 0) {
            if (errno == EINTR) continue; // 시그널 재시도
            return -1;
        }
        if (nread == 0) break; // EOF
        nleft -= nread;
        buf += nread;
    }
    return n - nleft;
}

// 파일 오프셋:
// read() 후 FD의 오프셋이 읽은 바이트만큼 증가
```

---

## 4. write()

```c
ssize_t write(int fd, const void *buf, size_t count);
// 반환: 쓴 바이트 수, -1 (오류)

// read()와 마찬가지로 Short Count 가능:
//   - 디스크 가득 참
//   - 소켓 송신 버퍼 가득 참
//   - 시그널 인터럽트

// 안전한 쓰기:
ssize_t writen(int fd, const char *buf, size_t n) {
    size_t nleft = n;
    ssize_t nwritten;
    while (nleft > 0) {
        nwritten = write(fd, buf, nleft);
        if (nwritten <= 0) {
            if (errno == EINTR) continue;
            return -1;
        }
        nleft -= nwritten;
        buf += nwritten;
    }
    return n;
}
```

---

## 5. lseek() - 파일 오프셋 변경

```c
off_t lseek(int fd, off_t offset, int whence);
// whence:
//   SEEK_SET: 파일 시작 + offset
//   SEEK_CUR: 현재 위치 + offset
//   SEEK_END: 파일 끝 + offset

// 현재 오프셋 확인:
off_t pos = lseek(fd, 0, SEEK_CUR);

// 파일 끝으로:
off_t size = lseek(fd, 0, SEEK_END);

// 랜덤 접근:
lseek(fd, 100, SEEK_SET);
read(fd, buf, 50); // 100번째 바이트부터 50바이트 읽기

// 파이프, 소켓은 lseek 불가 (순차적 스트림)
```

---

## 6. 파일 메타데이터: stat()

```c
#include <sys/stat.h>

int stat(const char *path, struct stat *statbuf);
int fstat(int fd, struct stat *statbuf);

struct stat {
    dev_t  st_dev;   // 장치 번호
    ino_t  st_ino;   // 아이노드 번호
    mode_t st_mode;  // 파일 타입 + 권한
    nlink_t st_nlink; // 하드 링크 수
    uid_t  st_uid;   // 소유자 UID
    gid_t  st_gid;   // 소유자 GID
    off_t  st_size;  // 파일 크기 (바이트)
    time_t st_atime; // 최근 접근 시간
    time_t st_mtime; // 최근 수정 시간
    time_t st_ctime; // 최근 상태 변경 시간
};

// 파일 타입 확인:
S_ISREG(st_mode)  // 일반 파일?
S_ISDIR(st_mode)  // 디렉터리?
S_ISSOCK(st_mode) // 소켓?
```

---

## 핵심 요약

- **open()**: 파일 열기, FD 반환. flags로 읽기/쓰기/생성 지정.
- **close()**: FD 해제. 항상 오류 체크.
- **read()**: 최대 n바이트 읽기. Short Count 발생 가능 → 반복 읽기 필요.
- **write()**: 최대 n바이트 쓰기. Short Count 발생 가능 → 반복 쓰기 필요.
- **lseek()**: 파일 오프셋 이동 (파이프/소켓 불가).
- **Short Count**: read/write가 요청보다 적게 처리 → 반드시 처리해야 함.
