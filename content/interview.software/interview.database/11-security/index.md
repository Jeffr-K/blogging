---
title: "데이터베이스 보안 (Security) 커리큘럼"
author: jeffrey
date: 2026-04-13
tags: ["security", "database-hardening", "sql-injection", "encryption"]
---

## 데이터베이스 보안: 데이터라는 자산을 지키는 최후의 보루

모든 성능 튜닝과 정교한 아키텍처도 단 한 번의 보안 사고 앞에서는 무용지물입니다. 데이터베이스 보안은 외부의 공격(Injection)을 막아내는 것부터 내부의 실수와 권한 남용을 방지하는 것까지 포괄적인 전략이 필요합니다.

---

### 📚 학습 커리큘럼

#### [01. SQL Injection 공격과 원천 봉쇄](./01-sql-injection-defense.md)

- 사용자 입력을 명령어로 오해하게 만드는 공격 원리 분석
- Prepared Statements와 파라미터 바인딩의 물리적 방어 기법
- ORM 사용 시 주의해야 할 취약점 패턴

#### [02. 인증과 권한 관리 (Authentication & RBAC)](./02-auth-and-rbac.md)

- Root 계정 사용 금지 원칙과 Least Privilege(최소 권한) 정책
- 역할 기반 권한 제어(RBAC)를 통한 정교한 접근 제한
- DB 계정 암호화 정책 및 주기적 교체 전략

#### [03. 암호화와 마스킹 (Encryption & Masking)](./03-encryption-masking.md)

- 저장 시 암호화(TDE, Transparent Data Encryption) 방식 분석
- 전송 시 암호화(SSL/TLS) 적용의 중요성
- 특정 사용자에게 개인정보 일부를 숨기는 데이터 마스킹 기술

#### [04. 네트워크 보안 및 액세스 제어](./04-network-security.md)

- DB를 Public 서브넷에 두지 말아야 하는 이유 (VPC 설계)
- 화이트리스트 기반의 방화벽(Security Group) 설정
- 리버시 프록시와 전용 보안 게이트웨이 활용법

#### [05. 데이터 감사와 컴플라이언스 (Auditing)](./05-db-auditing.md)

- "누가, 언제, 어떤 데이터를 보았는가?" - 감사 로그(Audit Log) 설정
- GDPR, ISMS 등 규제 대응을 위한 데이터 로깅 전략
- 이상 징후 감지 및 실시간 알림 시스템 구축

---

> [!CAUTION]
> 보안은 불편함과의 싸움입니다. 하지만 그 불편함을 감수하지 않았을 때 돌아오는 책임은 서비스 전체의 종료로 이어질 수 있음을 명심해야 합니다.
