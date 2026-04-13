# 테스팅 아티클 작성을 위한 AI 모델 지침 (AI Instructions)

코드 예제는 node.js nestjs jest 로 할것

하나의 개념에는 설명과 코드가 녹아져있는것이 보기 좋음.

---

## 🎯 [지침 승격] 테스팅 아티클 작성을 위한 AI 모델 규칙 (Instructions)

사용자님이 정의하신 핵심 원칙을 바탕으로, 모든 아티클은 아래의 하향식 원칙을 반드시 준수하여 생성되어야 합니다.

### 1. 콘텐츠의 본질과 서술 스타일 (Nature & Tone)

- **설명 중심의 딥다이브 (Deep-dive Narrative)**: 본 문서는 단순한 요약본이 아니라, 특정 테스팅 전략을 완벽히 정복할 수 있는 **'블로그 시리즈'** 형식이어야 한다.
- **파편화 방지**: 하나의 폴더에는 하나의 테스팅 전략만을 담으며, 그 하위에 개념부터 실전까지를 단계별 아티클로 분리하여 서술한다.
- **전문가적 식견 (Senior's Insight)**: 단순 지식 전달을 넘어, 실무에서의 트레이드오프와 시니어 엔지니어의 설계적 관점을 반드시 포함한다.

### 2. 물리적 구조 및 구성 (Structural Requirements)

- **전략별 폴더화**: 각 테스팅 전략은 `0*-strategy-name` 형식의 독립된 폴더를 가진다.
- **시리즈 필수 구성 요소**: 각 폴더 하위에는 최소한 아래의 흐름을 가진 아티클들이 포함되어야 한다.
  - `index.md`: 시리즈 전체 로드맵 및 목차
  - `01-concept.md`: 무엇인가? (Definition & Core Philosophy)
  - `02-why.md`: 왜 필요한가? (Problem solving & Comparison)
  - `03-how.md`: 어떻게 구현하는가? (Step-by-step implementation with code)
  - `04-when.md`: 언제 쓰는가? (Use cases & Trade-offs)
  - `05-real-world.md`: 실전 사례 (Complex domain applied scenarios)

### 3. 기술 및 마크다운 표준 (Technical & Markdown)

- **기술 스택**: Node.js, NestJS, Jest, Supertest, TypeScript (필요시 fp-ts, Effect.ts, Spring/Java 비교군 활용).
- **마크다운 린트**: 행 끝 공백 제거(MD009), 리스트 전용 빈 줄 확보(MD032), 최상단 H1 제목(MD041), 본문 H2 시작 등을 전수 준수한다.
- **AAA 패턴**: 모든 테스트 코드 예제는 Arrange, Act, Assert 구조를 명시적으로 따른다.

---

> [!IMPORTANT]
> "요약글은 불편하다"는 사용자 피드백을 수용하여, 모든 문서는 **충분히 길고 설명적**이어야 하며, 독자가 아티클만 보고도 실무에 즉시 적용할 수 있는 수준의 가이드를 제공해야 한다.
