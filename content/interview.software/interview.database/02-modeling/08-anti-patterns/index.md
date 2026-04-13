# Section 08. 모델링 안티패턴과 실무 사례 (Anti-patterns & Case Study)

데이터베이스 모델링의 완성은 **"하지 말아야 할 것"**을 아는 데 있습니다. 이론적인 정규화나 현란한 NoSQL 기술보다 중요한 것은, 우리 서비스의 미래를 망칠 수 있는 치명적인 설계 오류를 사전에 포착하고 해결하는 능력입니다. 이 섹션에서는 흔히 저지르는 안티패턴(Anti-patterns)과 실제 서비스의 생생한 진화 과정을 다룹니다.

## ✨ 왜(Why) 안티패턴과 사례 연구가 중요한가요?

- **사행성 설계 방지**: 겉보기엔 유연해 보이지만 조인 성능을 파괴하는 다형성 관계나 EAV의 함정을 피하기 위함입니다.
- **거인의 어깨 위에 서기**: 카카오, 네이버, 아마존 같은 서비스들이 겪었던 시행착오의 역사를 통해 우리 서비스의 성장을 미리 준비하기 위함입니다.
- **지속 가능한 스키마**: 데이터가 100배, 1000배 늘어났을 때도 서비스 중단 없이 스키마를 진화(Evolution)시키는 노하우를 배우기 위함입니다.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Polymorphic Association**: 하나의 외래키로 여러 테이블을 가리키려 할 때 발생하는 참조 무결성의 붕괴.
- **EAV Model**: 모든 속성을 가로가 아닌 세로로 저장할 때 마주하는 쿼리의 지옥.
- **Case Study (SNS/Commerce)**: 타임라인 조회와 주문/결제 무결성을 위한 실제 업계의 모델링 변천사.
- **Schema Evolution**: 무중단 이관(Migration)과 호환성을 고려한 지능적인 모델링 전술.

## 🛠 어떻게(How) 탐구하나요?

- `Like`나 `Comment` 테이블이 여러 종류의 포스트(Article, Photo, Video)를 참조해야 할 때 최적의 설계 대조.
- "모든 속성을 다 검색할 수 있게 해달라"는 기획적 요구사항을 EAV가 아닌 JSONB나 검색 엔진으로 풀어내는 과정.
- 실제 서비스의 확장 단계별(MVP -> Massive -> Global) 데이터 구조 변화 시뮬레이션.

---

## 📚 관련 아티클 목차

- [01. Polymorphic Association(다형성 관계)의 함정과 해결책](./modeling-antipattern-polymorphic.md) (작성 예정)
- [02. EAV(Entity-Attribute-Value) 모델: 언제 쓰고 언제 피해야 하는가?](./modeling-antipattern-eav.md) (작성 예정)
- [03. 대규모 서비스의 실제 모델링 변천사 분석 (SNS, 커머스 등)](./modeling-case-study-sns-commerce.md) (작성 예정)
- [04. 미래를 위한 데이터 모델링: 데이터 성장량 예측과 스키마 진화](./modeling-future-schema-evolution.md) (작성 예정)
