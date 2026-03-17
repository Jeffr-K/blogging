---
title: "리눅스 (Linux) 면접 및 실무 가이드"
date: 2026-03-17
tags:
  - cs
  - interview
  - linux
  - devops
---

# 리눅스 (Linux) 면접 및 실무 가이드

백엔드 개발자, 인프라 엔지니어(DevOps, SRE)에게 리눅스 환경에 대한 이해는 단순한 운영체제 지식을 넘어 **'문제가 발생했을 때 스스로 원인을 분석하고 해결할 수 있는 능력'**을 증명하는 가장 확실한 척도입니다. 

면접용 기본기부터 장애 상황(Troubleshooting)을 대비한 실무/심화 주제까지 계층별로 정리한 목차입니다.

---

## 1. 리눅스 기본기 (Linux Fundamentals)
리눅스의 철학과 파일 시스템, 그리고 가장 기본적인 명령어들을 다룹니다. 면접에서 운영체제(OS) 질문과 섞여서 나오는 경우가 많습니다.

*   [리눅스의 철학: "Everything is a file" (모든 것은 파일이다)](./everything-is-a-file)
*   [파일 시스템 구조 (/, /etc, /var, /proc 등 주요 디렉토리)](./file-system-hierarchy)
*   [파일 권한 (File Permissions)과 umask (rwx, chmod, chown)](./file-permissions)
*   [하드 링크(Hard Link) vs 심볼릭 링크(Symbolic Link)](./hard-vs-symbolic-link)
*   [패키지 관리자 (apt, yum)의 역할](./package-managers)

## 2. 프로세스와 자원 관리 (Process & Resource Management)
내 애플리케이션이 리눅스 위에서 어떻게 동작하고, 자원을 얼마나 소모하고 있는지 파악하는 기초입니다.

*   [프로세스 상태 (R, S, D, Z, T)와 좀비/고아 프로세스](./process-states)
*   [프로세스 간 통신 (IPC - 파이프, 소켓, 시그널 등)](./ipc-mechanisms)
*   [시그널 (Signal)의 종류 (SIGINT, SIGKILL, SIGTERM 차이)](./signals)
*   [데몬(Daemon) 프로세스와 백그라운드 실행 (`&`, `nohup`)](./daemon-and-background)
*   [(실무) `top`, `htop`, `ps`를 활용한 시스템 부하 분석](./monitoring-tools-top-ps)

## 3. 리눅스 네트워킹 (Linux Networking)
서버 간 통신 상태를 확인하고, 포트 충돌이나 연결 문제를 해결하기 위한 지식입니다.

*   [네트워크 인터페이스와 라우팅 테이블 확인 (`ip`, `route`)](./network-interfaces)
*   [DNS 질의 확인 (`nslookup`, `dig`)](./dns-tools)
*   [(실무) 포트 점유 확인 및 네트워크 연결 상태 확인 (`netstat`, `ss`, `lsof`)](./netstat-ss-lsof)
*   [(실무) 방화벽 기본 (iptables, ufw) 및 포트 포워딩](./firewall-iptables)
*   [(실무) `curl`과 `ping`을 활용한 간단한 헬스체크 및 연결 테스트](./curl-ping-healthcheck)

## 4. 쉘 스크립팅 및 텍스트 처리 (Shell Scripting & Text Processing)
서버 관리를 자동화하고, 방대한 로그 파일에서 원하는 정보를 빠르게 추출하는 실무의 꽃입니다.

*   [표준 입출력(stdin, stdout, stderr)과 리다이렉션 (`>`, `>>`, `<`)](./io-redirection)
*   [파이프 (`|`)를 이용한 명령어 조합](./pipe)
*   [(실무) 정규 표현식(Regex)과 `grep`을 활용한 로그 검색](./grep-and-regex)
*   [(실무) 스트림 편집과 텍스트 처리 (`awk`, `sed`)](./awk-sed)
*   [(실무) `find` 명령어를 통한 파일 검색 및 일괄 작업 처리 (`-exec`)](./find-command)

---

## 5. (심화/실무) 시스템 트러블슈팅 및 튜닝 (System Troubleshooting & Tuning)
단순한 명령어 사용을 넘어, 시스템 레벨에서 "왜 느린지?", "왜 죽었는지?"를 파악하는 고급 과정입니다.

*   [(심화) 리눅스 I/O 모델 (Blocking, Non-blocking, Sync, Async)](./io-models)
*   [(심화) 시스템 호출 추적 (`strace`를 활용한 병목 지점 찾기)](./strace)
*   [(심화) 메모리 누수(OOM, Out Of Memory) 발생 시 커널의 동작 (OOM Killer)](./oom-killer)
*   [(심화) 파일 디스크립터(File Descriptor) 한계 초과 이슈 (`ulimit`, `fs.file-max`)](./file-descriptor-limits)
*   [(심화) TCP 소켓 상태 트러블슈팅 (TIME_WAIT 고갈, SYN_RECV)](./tcp-socket-troubleshooting)
*   [(심화) Load Average의 정확한 의미와 CPU, I/O 대기 상태 분석](./load-average-explained)
*   [(심화) 커널 파라미터 튜닝 (`sysctl`, `/etc/sysctl.conf`) 기초](./sysctl-tuning)

## 6. (심화/실무) 컨테이너와 리눅스 격리 기술 (Linux for Containers)
Docker, Kubernetes 등 현대 클라우드 네이티브 환경의 근간이 되는 리눅스 커널 기술입니다.

*   [(심화) cgroups (Control Groups): 자원 할당과 제한](./cgroups)
*   [(심화) namespaces: 리소스 격리 (PID, NET, MNT 등)](./namespaces)
*   [(심화) 루트 파일 시스템 변경 (`chroot`)과 컨테이너의 원리](./chroot-and-containers)
*   [(심화) 오버레이 파일 시스템 (OverlayFS, UnionFS)의 구조](./overlayfs)

---

### 💡 실무 면접 대비 팁 (Practical Interview Tips)
*   **"서버가 느려졌다는 연락을 받았습니다. 접속해서 가장 먼저 어떤 명령어를 치고, 무엇을 확인하시겠습니까?"**
    *   이 질문은 실무 면접의 단골 소재입니다. `top`이나 `uptime`으로 Load Average 확인 -> CPU/Memory 바운드인지, I/O 바운드인지 파악 -> `netstat`으로 네트워크 상태 확인 -> `/var/log`에서 에러 로그(`grep`) 확인 등 **본인만의 논리적인 트러블슈팅 파이프라인**을 설명할 수 있어야 합니다.
*   **이론과 실제의 연결:** "OOM Killer가 무엇인가요?" 보다는 "애플리케이션이 갑자기 죽었는데 로그가 없습니다. OOM Killer에 의해 죽었는지 어떻게 확인하나요? (`dmesg` 또는 `/var/log/syslog` 등)"와 같이 실무 적용 방법을 함께 공부하세요.