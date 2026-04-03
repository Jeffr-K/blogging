# TDD 학습 인덱스

> **대전제**: TDD는 테스트를 먼저 작성하는 개발 방법론이 아니라, **설계를 개선하는 피드백 루프**다.
> 테스트가 통과하도록 코드를 짜는 것이 아니라, 테스트가 코드의 설계를 주도하게 만드는 것이다.
> 이 인덱스는 "왜 TDD인가"에서 출발해 "실무에서 지속 가능한 TDD"까지의 학습 경로를 정의한다.

---

## 왜 TDD인가?

```
전통적 개발:  요구사항 → 설계 → 구현 → 테스트 (테스트는 사후 검증)
TDD:          요구사항 → 테스트 → 최소 구현 → 리팩토링 (테스트가 설계를 이끈다)
```

TDD의 핵심 효과는 **빠른 피드백**과 **강제된 모듈화**다.
테스트하기 어려운 코드 = 설계가 나쁜 코드라는 사실을 즉시 알 수 있다.

---

## 학습 맵 — 전체 구조

```
┌──────────────────────────────────────────────────────┐
│                       TDD                             │
│                                                      │
│  ┌───────────┐  ┌────────────────┐  ┌─────────────┐  │
│  │   Red     │  │     Green      │  │  Refactor   │  │
│  │ 실패하는   │  │  통과시키는    │  │  개선하는   │  │
│  │  테스트   │  │   최소 코드    │  │   설계      │  │
│  └─────┬─────┘  └───────┬────────┘  └──────┬──────┘  │
│        │                │                  │          │
│   명세 작성         빠른 구현           리팩토링       │
│   설계 탐색         컴파일 오류 제거    중복 제거      │
│   API 설계          단순한 해법         추상화         │
└──────────────────────────────────────────────────────┘
```

---

## 1. 대전제 — TDD 철학

### 왜 TDD를 하는가
- TDD는 테스트 기법이 아닌 설계 기법이다
- 회귀 방어(Regression Safety)와 리팩토링 용기
- 빠른 피드백 루프 — 문제를 늦게 발견할수록 비용이 기하급수적으로 증가
- Living Documentation — 테스트가 곧 명세다
- Testability = Designability — 테스트하기 쉬운 코드가 좋은 코드다

### TDD의 역사와 맥락
- Kent Beck과 Extreme Programming (XP)
- Test-First Programming → TDD로의 발전
- Classical(Detroit) vs Mockist(London) TDD 학파
- BDD(Behavior-Driven Development)로의 확장

### 흔한 오해
- "TDD는 느리다" — 단기 비용 vs 장기 이익
- "테스트 커버리지 100%가 목표다" — 커버리지는 부산물
- "모든 코드에 TDD를 적용해야 한다" — 언제 TDD가 효과적인가
- "TDD를 하면 버그가 없다" — TDD가 잡지 못하는 것들

---

## 2. Red-Green-Refactor 사이클

### Red — 실패하는 테스트 작성
- 테스트를 먼저 작성하는 이유 — 사용자 관점에서 API 설계
- 컴파일 오류도 실패다 — 인터페이스부터 정의하기
- 하나의 테스트, 하나의 이유 — 단일 책임 원칙
- 테스트 이름 작성법 — 행동 명세로서의 이름
- 빠른 실패 확인 — 테스트가 정말 실패하는지 검증

### Green — 최소한의 코드로 통과
- 최대한 단순하게 — YAGNI (You Aren't Gonna Need It)
- 하드코딩으로 시작하기 — 삼각측량(Triangulation) 기법
- Fake It Till You Make It
- 명백한 구현(Obvious Implementation) — 해법이 명확할 때
- 컴파일 오류 → 테스트 실패 → 테스트 통과의 단계적 접근

### Refactor — 설계 개선
- 리팩토링의 정의 — 동작을 유지하면서 구조를 개선
- 리팩토링 시작 신호 — 코드 냄새(Code Smell) 감지
- 중복 제거 — DRY 원칙 적용
- 테스트 없는 리팩토링은 리팩토링이 아니다
- 리팩토링 패턴 — Extract Method, Extract Class, Move Method

---

## 3. 단위 테스트 원칙

### F.I.R.S.T 원칙
- **Fast** — 테스트는 빠르게 실행되어야 한다 (밀리초 단위)
- **Isolated** — 테스트는 서로 독립적이어야 한다
- **Repeatable** — 어떤 환경에서도 동일한 결과
- **Self-validating** — 통과/실패를 스스로 판단
- **Timely** — 프로덕션 코드 직전 또는 동시에 작성

### 좋은 단위 테스트의 구조
- Given-When-Then (Arrange-Act-Assert) 패턴
- 하나의 테스트에는 하나의 Assert
- 테스트 데이터 빌더 패턴
- 경계값 분석 — 경계에서 버그가 발생한다
- 동등 클래스 분류 — 대표값으로 테스트

### 테스트 냄새 (Test Smells)
- 제목 없는 테스트 — `test1`, `testMethod` 같은 무의미한 이름
- 다중 Assert — 무엇이 실패했는지 파악하기 어려움
- 테스트 간 의존성 — 실행 순서에 따라 결과가 달라짐
- 과도한 셋업 — 테스트보다 준비 코드가 더 많음
- Obscure Test — 테스트 의도를 파악하기 어려움
- Fragile Test — 구현 변경에 쉽게 깨지는 테스트

---

## 4. 테스트 더블 (Test Doubles)

### 테스트 더블의 종류
- **Dummy** — 전달은 되지만 실제로 사용되지 않는 객체
- **Stub** — 미리 정해진 답변을 반환하는 객체
- **Spy** — 호출 기록을 남기는 Stub
- **Mock** — 기대하는 호출을 미리 명세하는 객체
- **Fake** — 실제 동작하는 간단한 구현체 (InMemory DB 등)

### Mock vs Stub
- 상태 검증(State Verification) vs 행동 검증(Behavior Verification)
- Classical TDD — 가급적 실제 객체, Stub/Fake 선호
- Mockist TDD — Mock으로 협력 객체 격리
- Mock이 설계를 드러내는 방법 — 너무 많은 Mock은 설계 문제 신호

### 테스트 더블 사용 지침
- 느린 의존성 교체 — DB, 네트워크, 파일 시스템
- 비결정적 의존성 교체 — 시간, 난수
- 아직 존재하지 않는 협력 객체
- 외부 시스템의 오류 시나리오 재현
- Mock을 과도하게 사용하면 리팩토링이 어려워진다

---

## 5. 테스트 피라미드와 수준별 테스트

### 테스트 피라미드
```
        /    \
       / E2E  \           느림, 비용 높음, 신뢰도 높음
      /-────── \
     / 통합 테스트 \        중간
    /────────────\
   /  단위 테스트    \      빠름, 비용 낮음, 격리된 검증
  /────────────────\
```

### 단위 테스트 (Unit Test)
- 단일 클래스/함수의 동작 검증
- 외부 의존성 격리
- 밀리초 단위 실행

### 통합 테스트 (Integration Test)
- 여러 컴포넌트의 협력 검증
- 실제 DB, 실제 HTTP 사용
- 슬라이스 테스트 — 레이어 단위 통합 테스트

### E2E / 인수 테스트 (Acceptance Test)
- 사용자 시나리오 전체 검증
- BDD 시나리오와 연결
- 피라미드 꼭대기 — 소수의 핵심 시나리오만

### 계약 테스트 (Contract Testing)
- 서비스 간 API 계약 검증
- Consumer-Driven Contract Testing
- Pact 프레임워크

---

## 6. BDD — 행동 주도 개발

### BDD의 등장 배경
- TDD의 "테스트"라는 단어가 주는 오해
- Dan North와 BDD의 탄생
- 개발자-비개발자 협업을 위한 공통 언어
- Example Mapping — 예시로 요구사항 명세

### Given-When-Then 시나리오
- Gherkin 문법 — Feature, Scenario, Given, When, Then
- 시나리오 작성 원칙 — 구체적, 단일, 독립적
- 선언적 시나리오 vs 명령적 시나리오
- Living Documentation — 시나리오가 살아있는 문서

### 도구
- Cucumber (Java/Ruby/JS)
- JBehave
- SpecFlow (.NET)
- Pytest-BDD (Python)

---

## 7. 아키텍처와 TDD

### 테스트하기 좋은 아키텍처
- 의존성 역전(DIP) — 테스트 더블을 가능하게 만드는 원칙
- 포트와 어댑터 (Hexagonal Architecture)
  - 포트: 인터페이스 (테스트에서 Fake로 교체)
  - 어댑터: 구체적 구현 (DB, HTTP 등)
- 순수 함수와 불변 객체 — 테스트하기 가장 쉬운 형태
- 도메인 로직과 부수 효과 분리

### 레이어별 TDD 전략
- 도메인 레이어 — 순수 단위 테스트, Mock 없이
- 애플리케이션 서비스 — Stub/Spy로 의존성 교체
- 어댑터 레이어 — 통합 테스트로 실제 연동 검증
- Outside-In TDD — E2E 테스트에서 시작해 안쪽으로

### Legacy Code와 TDD
- Characterization Test — 현재 동작을 먼저 문서화
- Seam(이음매) 찾기 — 테스트 더블 삽입 지점
- Sprout Method/Class — 새 기능은 TDD로 추가
- Wrap 기법 — 레거시를 감싸서 격리

---

## 8. 고급 TDD 기법

### Property-Based Testing
- 예시 기반 테스트의 한계 — "내가 생각한 케이스"만 검증
- 속성(Property) 정의 — 항상 참이어야 하는 불변 조건
- 랜덤 입력 자동 생성 — 반례(Counterexample) 발견
- Shrinking — 최소 반례로 줄이기
- 도구: QuickCheck, Hypothesis(Python), jqwik(Java)

### Mutation Testing
- 테스트 품질 측정 — 커버리지의 한계를 보완
- 코드를 변형(Mutant)하고 테스트가 잡는지 확인
- 살아남은 Mutant = 테스트가 놓친 케이스
- 도구: PIT(Java), Mutmut(Python), Stryker(JS)

### 스냅샷 테스트 (Snapshot Testing)
- UI 컴포넌트, JSON 응답 등 출력 변화 감지
- 스냅샷 업데이트 시 주의사항
- 언제 적합하고 언제 부적합한가

### 골든 마스터 테스트 (Approval Testing)
- 레거시 코드의 현재 동작을 기준으로 고정
- Approval Tests 라이브러리

---

## 9. TDD 실무 적용

### TDD 도입 전략
- 새 코드부터 시작 — 레거시를 바꾸려 하지 말것
- 쉬운 것부터 — 순수 도메인 로직, 유틸리티
- 페어 프로그래밍 / Ping-Pong TDD
- Kata 연습 — FizzBuzz, Roman Numerals, Bowling Game

### 팀으로서의 TDD
- CI/CD 파이프라인에서의 테스트 전략
- 테스트 코드도 프로덕션 코드다 — 코드 리뷰 대상
- 테스트 유지보수 비용 관리
- 테스트 전략 문서화 — Testing Trophy, Test Pyramid 결정

### 언어/프레임워크별 TDD
- **Java/Kotlin**: JUnit 5, AssertJ, MockK, TestContainers
- **Python**: pytest, unittest.mock, Hypothesis
- **JavaScript/TypeScript**: Jest, Vitest, Testing Library
- **Spring Boot**: @SpringBootTest, @WebMvcTest, @DataJpaTest
- **React**: React Testing Library, MSW

---

## 10. 연습 — TDD Kata

### 입문 Kata
- FizzBuzz — 분기 로직의 TDD
- Roman Numerals — 변환 로직의 TDD
- String Calculator — 파서의 TDD
- Leap Year — 조건 분기의 TDD

### 중급 Kata
- Bowling Game — 복잡한 계산 로직
- Mars Rover — 객체지향 설계 + TDD
- Bank Account — 상태 관리
- Word Wrap — 알고리즘의 TDD

### 고급 Kata
- Gilded Rose — 레거시 코드 리팩토링
- Theatrical Players — 마틴 파울러 리팩토링 예제
- Tennis Refactoring Kata

---

## 학습 로드맵 (권장 순서)

```
기초 (1개월)
├── Red-Green-Refactor 사이클 체득 (FizzBuzz, String Calculator Kata)
├── F.I.R.S.T 원칙과 Given-When-Then 구조
├── 테스트 더블 5가지 이해
└── 단위 테스트 프레임워크 숙달 (JUnit/pytest/Jest)

중급 (2개월)
├── Mock vs Stub 실전 구분
├── 테스트 피라미드 적용 — 프로젝트에서 비율 결정
├── 레거시 코드 Characterization Test 작성
└── 통합 테스트 전략 (TestContainers, Wiremock)

고급 (3개월)
├── Property-Based Testing 도입
├── Mutation Testing으로 테스트 품질 측정
├── 헥사고날 아키텍처 + TDD
└── Outside-In TDD 실전 적용
```
