# Section 07. NoSQL 데이터 아키텍처 (NoSQL Modeling Strategy)

NoSQL은 "SQL이 없다"는 뜻이 아니라, "관계형 모델만이 정답은 아니다(Not Only SQL)"라는 선언입니다. 데이터의 형태(Shape)와 읽기/쓰기 패턴(Access Pattern)에 따라 RDBMS보다 수백 배 빠른 성능과 유연성을 제공하는 NoSQL의 세계는 현대 백엔드 아키텍처의 필수 요소입니다.

## ✨ 왜(Why) NoSQL 모델링을 알아야 하나요?

- **스키마의 유연성**: 데이터 구조가 수시로 변하는 초기 스타트업이나 로그성 데이터를 수용하기 위함입니다.
- **초고속 응답성**: 밀리초(ms) 단위의 응답이 필요한 실시간 랭킹, 세션 관리, 캐싱을 실현하기 위함입니다.
- **거대한 연결 분석**: 단순 조인으로는 해결할 수 없는 복잡한 인맥 관계나 추천 시스템을 효율적으로 구현하기 위함입니다.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Document Store (MongoDB)**: 중첩된 객체(Embedded)를 쓸 것인가, 별도 컬렉션(Reference)으로 나눌 것인가.
- **Key-Value (Redis)**: 단순 키-값 이상의 자료구조(Sorted Set, Hash)를 이용한 실전 랭킹 시스템 설계.
- **Wide Column (Cassandra)**: 쓰기에 최적화된 LSM Tree 구조와 복제 전략.
- **Graph & Vector DB**: 노드와 간선 중심의 모델링과 AI 시대의 필수품인 벡터 유사도 검색.
- **Polyglot Persistence**: 각 데이터의 특성에 맞춰 여러 DB를 유기적으로 결합하는 멀티 DB 아키텍처.

## 🛠 어떻게(How) 탐구하나요?

- RDBMS의 조인 기반 쿼리와 MongoDB의 임베딩 기반 쿼리의 성능 및 복잡도 비교.
- Redis의 `Pub/Sub`과 `Streams`를 활용한 실시간 알림 시스템 모델링.
- RDBMS 메인 데이터를 Elasticsearch나 Vector DB로 실시간 동기화하는 파이브라인 구축 전략 수립.

---

## 📚 관련 아티클 목차

- [01. Document Store(MongoDB)에서의 데이터 중복 vs 참조 결정](./nosql-document-modeling.md) (작성 예정)
- [02. Key-Value(Redis)와 Wide Column(Cassandra)의 접근 패턴 중심 설계](./nosql-key-value-wide-column.md) (작성 예정)
- [03. Graph Database(Neo4j)와 벡터 데이터베이스(Vector DB)의 특수 모델링](./nosql-graph-vector-modeling.md) (작성 예정)
- [04. 폴리글랏 퍼시스턴스(Polyglot Persistence): RDBMS와 NoSQL의 유기적 결합](./nosql-polyglot-persistence.md) (작성 예정)
