---
title: "시스템 콜(System Call): 커널과의 인터페이스"
author: jeffrey
date: 2026-04-10
tags: ["computer-architecture", "system-call", "syscall", "kernel", "csapp"]
---

## 시스템 콜 (System Call)

시스템 콜은 **사용자 프로그램이 OS 커널의 서비스를 요청**하는 유일한 공식 경로입니다. 파일 I/O, 프로세스 생성, 메모리 할당 등 모든 시스템 자원 접근은 시스템 콜을 통해 이루어집니다.

---

## 1. 왜 시스템 콜이 필요한가?

```
사용자 모드 (Ring 3):
  - 일반 프로그램 실행 공간
  - 하드웨어 직접 접근 불가
  - 다른 프로세스 메모리 접근 불가

커널 모드 (Ring 0):
  - OS 커널 실행 공간
  - 모든 하드웨어 접근 가능
  - 모든 메모리 접근 가능

→ 사용자 프로그램이 파일을 읽으려면?
  직접 디스크 접근 불가 → 커널에 요청 → 커널이 대신 처리

시스템 콜 = 사용자 모드 → 커널 모드로의 제어된 진입점
```

---

## 2. 시스템 콜 작동 방식 (x86-64)

```asm
; write() 시스템 콜 예시 (fd=1, buf="Hello\n", count=6)
mov rax, 1      ; 시스템 콜 번호: write = 1
mov rdi, 1      ; 인자 1: fd = 1 (stdout)
mov rsi, msg    ; 인자 2: 버퍼 주소
mov rdx, 6      ; 인자 3: 바이트 수
syscall         ; 트랩 → 커널 모드 진입!
                ; 커널이 write 처리 후 복귀
                ; rax = 반환값 (실제 쓴 바이트 수)
```

x86-64 시스템 콜 규약:
```
시스템 콜 번호: rax
인자:          rdi, rsi, rdx, r10, r8, r9 (최대 6개)
반환값:        rax (음수 = 에러, errno로 변환)
```

---

## 3. 시스템 콜 vs 함수 호출

```
일반 함수 호출:
  call printf → printf 실행 → ret
  권한 전환 없음, 수 ns

시스템 콜:
  syscall → 커널 모드 전환 → 처리 → 사용자 모드 복귀
  권한 전환: 수백 ns (200~500ns 오버헤드!)

오버헤드 원인:
  1. 특권 레벨 전환 (Ring 3 → Ring 0)
  2. 레지스터 저장/복원
  3. TLB 플러시 (KPTI 패치 이후, Meltdown 완화)
  4. 캐시 오염 (커널 코드가 캐시 점유)
```

---

## 4. C 표준 라이브러리와 시스템 콜

```
printf("Hello") → C 라이브러리 함수
    → 버퍼링 (stdio)
    → 충분히 채워지면 write() 시스템 콜
    → 커널이 실제로 출력

계층:
사용자 코드 → libc (glibc) → 시스템 콜 → 커널

libc가 하는 일:
  - 에러 처리 (errno 설정)
  - 버퍼링 (fread/fwrite)
  - 타입 안전성 (ssize_t vs size_t)
  - 플랫폼 이식성 (다른 OS에서도 동작)
```

---

## 5. 주요 Linux 시스템 콜 목록

```
번호 | 이름      | 설명
─────────────────────────────────────────────────
0    | read      | 파일에서 읽기
1    | write     | 파일에 쓰기
2    | open      | 파일 열기
3    | close     | 파일 디스크립터 닫기
5    | fstat     | 파일 정보 가져오기
9    | mmap      | 메모리 매핑
11   | munmap    | 메모리 매핑 해제
12   | brk       | 힙 메모리 확장
57   | fork      | 프로세스 복제
59   | execve    | 새 프로그램 실행
60   | exit      | 프로세스 종료
61   | wait4     | 자식 프로세스 대기
62   | kill      | 시그널 전송
102  | getuid    | 사용자 ID 가져오기
231  | exit_group| 모든 스레드 종료
```

---

## 6. strace: 시스템 콜 추적

```bash
# 모든 시스템 콜 추적
strace ./program

# 특정 시스템 콜만 추적
strace -e trace=read,write,open ./program

# 출력 예:
execve("./program", ["./program"], 0x7fff... /* 23 vars */) = 0
brk(NULL)                               = 0x55d9...
mmap(NULL, 8192, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7f...
open("data.txt", O_RDONLY)             = 3
read(3, "Hello, World!\n", 4096)       = 14
write(1, "Hello, World!\n", 14)        = 14
close(3)                               = 0
exit_group(0)                           = ?

# 시스템 콜 통계
strace -c ./program
# % time     seconds  usecs/call     calls    errors syscall
# 100.00    0.000156          78         2           read
#   0.00    0.000000           0         1           write
```

---

## 7. 시스템 콜 최소화

```c
// 나쁨: 매 문자마다 write() 시스템 콜
for (int i = 0; i < 1000; i++) {
    write(1, &data[i], 1);  // 1000번의 시스템 콜!
}

// 좋음: 한 번에 쓰기 (1번의 시스템 콜)
write(1, data, 1000);

// 최선: stdio 버퍼링 활용
FILE *f = fopen("file.txt", "w");
for (int i = 0; i < 1000; i++) {
    fputc(data[i], f);  // 내부 버퍼에 쌓임
}
fclose(f);  // 한 번에 flush → 시스템 콜 최소화
```

---

## 핵심 요약

- **시스템 콜**: 사용자 프로그램이 OS 커널 서비스를 요청하는 공식 경로.
- **트랩 메커니즘**: `syscall` 명령어로 Ring 3 → Ring 0 전환. rax에 번호, rdi/rsi/... 에 인자.
- **비용**: 일반 함수 호출 대비 100~1000× 느림 (권한 전환 + 컨텍스트 비용).
- **libc 래핑**: printf, fopen 등은 내부적으로 write, open 시스템 콜 호출. 버퍼링으로 빈도 감소.
- **strace**: 실행 중 시스템 콜을 실시간 모니터링. 디버깅과 성능 분석에 필수.
