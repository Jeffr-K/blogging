---
title: "메모리 매핑 (Memory Mapping): mmap()의 원리"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "virtual-memory", "mmap", "memory-mapping", "csapp"]
---

## mmap() - 메모리 매핑

파일이나 장치를 프로세스의 가상 주소 공간에 직접 매핑하는 시스템 콜입니다.

---

## 1. mmap()의 기본 개념

```c
#include <sys/mman.h>

void *mmap(void *addr,    // 매핑 시작 주소 힌트 (보통 NULL)
           size_t length, // 매핑 크기
           int prot,      // 보호 플래그 (PROT_READ|PROT_WRITE|PROT_EXEC)
           int flags,     // 매핑 타입 (MAP_SHARED, MAP_PRIVATE, MAP_ANONYMOUS)
           int fd,        // 파일 디스크립터 (익명 매핑 시 -1)
           off_t offset); // 파일 오프셋
// 반환: 매핑된 가상 주소 (실패 시 MAP_FAILED)

// 해제
int munmap(void *addr, size_t length);
```

---

## 2. 파일 매핑 (File-backed Mapping)

```c
// 파일을 메모리에 매핑
int fd = open("data.bin", O_RDWR);
char *buf = mmap(NULL, file_size, PROT_READ|PROT_WRITE,
                 MAP_SHARED, fd, 0);
close(fd); // fd 닫아도 매핑은 유지

// 파일 내용을 메모리처럼 직접 접근
buf[0] = 'H';  // 파일의 첫 바이트 수정
buf[1] = 'i';
msync(buf, file_size, MS_SYNC); // 디스크에 반영
munmap(buf, file_size);
```

```
동작 원리:
  1. mmap() 호출 → 페이지 테이블에 매핑 등록 (Present=0)
  2. 실제 파일 내용은 아직 메모리에 없음
  3. buf[0] 접근 → 페이지 폴트 (마이너 or 메이저)
  4. OS가 파일에서 해당 페이지 로드
  5. 이후 접근은 일반 메모리 접근과 동일

장점:
  ✓ read()/write() 없이 파일 접근 → 버퍼 복사 없음
  ✓ 페이지 캐시와 공유 (커널 버퍼 없어도 됨)
  ✓ OS가 I/O 타이밍 최적화
```

---

## 3. 익명 매핑 (Anonymous Mapping)

```c
// 파일 없이 메모리만 할당
void *mem = mmap(NULL, size,
                 PROT_READ|PROT_WRITE,
                 MAP_PRIVATE|MAP_ANONYMOUS, -1, 0);
// malloc의 내부 구현에서 대용량 할당 시 사용
// (작은 할당: brk/sbrk, 큰 할당: mmap)
```

---

## 4. MAP_SHARED vs MAP_PRIVATE

```
MAP_SHARED:
  매핑된 메모리 수정 → 파일에 직접 반영
  여러 프로세스가 같은 파일 매핑 시 변경사항 공유
  IPC(프로세스 간 통신)에 활용

MAP_PRIVATE:
  Copy-On-Write (COW) 의미론
  수정 시 새 물리 프레임 할당 → 파일/다른 프로세스 영향 없음
  프로세스 종료 시 사라짐

비교:
  MAP_SHARED  → 데이터베이스 파일 공유, IPC
  MAP_PRIVATE → 실행 파일 코드 로딩 (쓰기 필요 없음)
                fork() 후 COW 메모리
```

---

## 5. 실행 파일 로딩

```
OS가 프로그램 실행 시 mmap() 사용:

execve("./a.out", ...):
  1. ELF 헤더 파싱
  2. 각 세그먼트를 mmap()으로 가상 주소에 매핑:
     - 텍스트(.text): MAP_PRIVATE|MAP_EXEC
     - 데이터(.data): MAP_PRIVATE|MAP_WRITE
     - BSS: MAP_PRIVATE|MAP_ANONYMOUS (파일 없음)
  3. 스택, 힙 영역 설정
  4. 엔트리 포인트(_start)로 점프

디맨드 로딩:
  실제 코드 실행 전까지 물리 메모리 사용 안 함
  페이지 폴트로 필요한 부분만 로드
```

---

## 6. 공유 메모리 (Shared Memory)

```c
// 두 프로세스가 같은 파일을 MAP_SHARED로 매핑
// → 동일 물리 페이지 공유 → 제로 복사 IPC

// 프로세스 A
void *shm = mmap(NULL, 4096, PROT_READ|PROT_WRITE,
                 MAP_SHARED, fd, 0);
// 데이터 씀

// 프로세스 B  
void *shm = mmap(NULL, 4096, PROT_READ|PROT_WRITE,
                 MAP_SHARED, fd, 0);
// A가 쓴 데이터 읽음 (페이지 복사 없음!)
```

---

## 핵심 요약

- **mmap()**: 파일/장치를 가상 주소 공간에 직접 매핑.
- **파일 매핑**: 페이지 폴트로 필요 시 파일 내용 로드. read/write 오버헤드 없음.
- **익명 매핑**: 파일 없는 메모리 (대용량 malloc 구현).
- **MAP_SHARED**: 수정이 파일/다른 프로세스에 반영 (IPC).
- **MAP_PRIVATE**: COW, 수정해도 원본 불변.
- **실행 파일 로딩**: OS가 내부적으로 mmap() 사용.
