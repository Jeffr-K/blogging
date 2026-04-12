# Testing Internals (테스팅: 견고한 코드를 위한 내부 설계)

NestJS는 강력한 테스팅 유틸리티를 제공합니다. 이 섹션은 `TestingModule`이 어떻게 작동하는지, 그리고 왜 우리가 이를 활용해 테스트해야 하는지를 다룹니다.

## ✨ 왜(Why) 들여다봐야 하나요?

- 모듈별로 완벽하게 격리된 단위 테스트 환경을 구축하기 위해.
- 실제 데이터베이스나 외부 API와 연동된 복잡한 통합 테스트를 효율적으로 관리하기 위해.
- 테스팅 유의사항을 파헤쳐 팀의 코드 품질을 체계적으로 높이기 위해.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **TestingModule**: NestJS 컨테이너를 가상으로 생성하고 모킹(Mocking)하는 내부 메커니즘.
- **overrideProvider**: 실제 프로바이더를 가짜 프로바이더로 교체하는 동작 방식.
- **NestContainer in Tests**: 테스트용 컨테이너의 부트스트래핑 과정.
- **E2E Testing**: `Test.createTestingModule`과 `Supertest`가 결합되어 실제 요청을 처리하는 여정.

## 🛠 어떻게(How) 탐구하나요?

- `@nestjs/testing` 패키지의 `testing-module.js` 소스 코드 교차 분석.
- 테스트 중에 발생하는 의존성 주입 이슈와 인스턴스 공유 문제를 수동으로 재현 및 분석.
- Jest와 NestJS 테스팅 유틸리티를 결합한 최적의 테스팅 패턴 도출.

---

## 📚 관련 아티클 목차

- [01. TestingModule의 내부 모킹 메커니즘 분석](./testing-module-internals.md) (작성 예정)
- [02. overrideProvider: 의존성 주입을 완벽하게 가로채는 방법](./override-provider-how-it-works.md) (작성 예정)
- [03. NestJS 통합 테스트와 E2E 테스트 환경 구축 전략](./integration-and-e2e-testing.md) (작성 예정)
- [04. 실전: 테스트 컨테이너 성능 최적화와 병렬 실행 구축 가이드](./testing-performance-optimization.md) (작성 예정)
