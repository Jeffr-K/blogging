# Section 02. 관계 설계와 무결성 (Relationship & Integrity)

데이터베이스의 힘은 엔티티 간의 '관계' 위에 세워집니다. 이 섹션에서는 두 실체가 어떻게 연결되고, 그 연결이 끊어졌을 때 데이터가 어떻게 스스로를 보호하는지(무결성)를 딥다이브합니다.

## ✨ 왜(Why) 관계와 무결성을 깊이 알아야 하나요?

- **데이터 미아 방지**: 부모가 삭제되었는데 자식이 남아있는 '고아 레코드'는 데이터 오염의 시작입니다.
- **성능과 유연성의 절충**: M:N 관계를 어떻게 해소하느냐에 따라 조인 성능과 비즈니스 확장성이 결정됩니다.
- **아키텍처적 결정**: 식별 관계와 비식별 관계의 선택은 테이블의 PK 구조와 직결됩니다.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Relationship Mapping**: 1:1, 1:N, M:N 각 타입별 물리적 스키마 구현 전략.
- **Identification**: 부모의 PK가 자식의 PK의 일부가 되느냐 마느냐의 차이.
- **Foreign Key**: FK 제약 조건이 주는 데이터 안전성과 성능(Lock) 오버헤드 사이의 관계.
- **Cascade**: 연쇄 삭제와 수정이 비즈니스 코드 없이 어떻게 엔진에서 처리되는지.

## 🛠 어떻게(How) 탐구하나요?

- 실제 커머스 도메인(주문-주문상품-배송)의 엔티티 간 관계도 작성.
- FK 제약 조건이 걸린 테이블에서 대량 삽입/삭제 시 발생하는 락 대기 현상 분석.
- 연결 테이블(Mapping Table)을 추가하여 M:N 관계를 1:N으로 해소하는 실습.

---

## 📚 관련 아티클 목차

- [01. 1:1, 1:N, M:N 관계 설계의 정석과 해소법](./relational-mapping-strategies.md) (작성 예정)
- [02. 식별 관계(Identifying) vs 비식별 관계(Non-identifying): 설계의 갈림길](./identifying-vs-non-identifying.md) (작성 예정)
- [03. 참조 무결성(Referential Integrity)과 Foreign Key 제약 조건의 허와 실](./referential-integrity-and-fk.md) (작성 예정)
- [04. CASCADE 정책과 데이터 정합성 관리 전략](./cascade-strategy.md) (작성 예정)
