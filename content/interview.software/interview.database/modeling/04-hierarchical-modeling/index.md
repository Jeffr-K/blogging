# Section 04. 특수 구조 및 계층 모델링 (Hierarchy & Structures)

현실의 데이터는 고정된 테이블 구조뿐만 아니라, 무한히 깊어질 수 있는 **계층(Hierarchy)**과 정해지지 않은 **비정형(Semi-structured)**의 형태를 띱니다. RDBMS라는 정적인 표 구조 위에서 이러한 유연한 관계를 어떻게 성능 저하 없이 구현할지가 이 섹션의 핵심입니다.

## ✨ 왜(Why) 특수 구조 모델링을 알아야 하나요?

- **재귀 조인의 지옥 방지**: 단순히 상위 ID만 가지고 있는 구조로는 10단계 깊이의 조직도를 가져올 때 10번의 조인이 필요합니다. 이를 1번의 쿼리로 끝내기 위함입니다.
- **유연한 데이터 수용**: 모든 속성을 칼럼으로 만들 수 없는 동적인 요구사항(추가 옵션, 사용설명서 등)을 처리하기 위함입니다.
- **최적의 조회 성능**: 카테고리의 하위 요소를 모두 찾는 쿼리를 인덱스 스캔 한 번으로 끝내기 위한 설계를 배우기 위함입니다.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **Adjacency List**: 가장 단순한 `parent_id` 구조와 recursive CTE의 활용.
- **Path Enumeration**: `1/4/7/22`와 같은 문자열 경로를 이용한 계층 탐색.
- **Nested Sets**: 트리 구조를 수치 범위(`left`, `right`)로 치환하여 조회 성능을 극대화하는 기법.
- **Closure Table**: 모든 부모-자식 관계를 별도 테이블에 저장하여 확장성과 속도를 모두 잡는 정석.
- **JSONB vs EAV**: 비정형 데이터를 담는 두 가지 상반된 접근 방식의 트레이드오프.

## 🛠 어떻게(How) 탐구하나요?

- 무한 댓글 시스템을 4가지 방식으로 각각 설계하고 조회 쿼리의 복잡도 비교.
- `Recursive CTE`를 지원하지 않는 이전 버전의 DB에서 계층 구조를 찾는 고전적 기법 복기.
- JSONB 인덱싱(GIN Index)과 EAV 조인 성능을 실제 수만 건의 데이터로 테스트.

---

## 📚 관련 아티클 목차

- [01. 인접 리스트(Adjacency List) vs 경로 열거(Path Enumeration)](./hierarchical-adjacency-path.md) (작성 예정)
- [02. 중첩 집합(Nested Sets) 모델의 조회 성능 극대화](./hierarchical-nested-sets.md) (작성 예정)
- [03. 클로저 테이블(Closure Table): 확장성과 성능을 모두 잡는 계층 구조의 정석](./hierarchical-closure-table.md) (작성 예정)
- [04. 비정형 데이터(Semi-structured)의 수용: JSONB와 EAV 모델 설계의 선택](./semi-structured-jsonb-eav.md) (작성 예정)
