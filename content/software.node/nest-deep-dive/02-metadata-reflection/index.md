# Metadata & Reflection (메타데이터와 리플렉션: 데이터의 마법)

NestJS는 모든 것을 데코레이터(`@`)로 시작합니다. 이 섹션은 이 데코레이터가 클래스에 어떻게 데이터를 '붙이고', 다시 '읽어서' 활용하는지를 분석합니다.

## ✨ 왜(Why) 들여다봐야 하나요?

- NestJS가 제공하는 것 이상의 기능을 가진 우리 팀만의 커스텀 데코레이터를 만들기 위해.
- 클래스에 붙은 전역 메타데이터를 런타임에 동적으로 읽어와 스캔하는 시스템을 구축하기 위해.
- 프레임워크가 어떻게 TypeScript의 타입을 런타임에 알고 주입해주는지 그 마법의 정체를 알기 위해.

## 🔍 무엇을(What) 핵심적으로 보나요?

- **reflect-metadata**: NestJS의 기반이 되는 이 라이브러리가 어떻게 클래스의 메타데이터 레지스트리를 관리하는지.
- **Reflector**: NestJS가 제공하는 메타데이터 접근 도구의 한계와 확장 방법.
- **Metadata Scanner**: 등록된 모든 클래스를 한 번에 훑으며 특정 데코레이터가 붙었는지 찾는 과정.
- **Custom Decorator**: 메카니즘을 활용한 실전 데코레이터(Auth, Custom-API-Key 등) 제작.

## 🛠 어떻게(How) 탐구하나요?

- `Reflect.getMetadata()`를 직접 호출하여 데코레이터가 남긴 흔적을 수동으로 찾아보기.
- `DiscoveryModule`을 사용하여 컨테이너 내의 프로바이더 메타데이터를 실시간으로 출력하는 샘플 프로젝트 구현.
- `NestCompiler`가 `@Module`을 컴파일할 때 어떤 메타데이터가 맵핑되는지 명세서 분석.

---

## 📚 관련 아티클 목차

- [01. reflect-metadata 라이브러리의 역할과 동작 원리](./reflect-metadata-internals.md) (작성 예정)
- [02. Reflector 클래스: 메타데이터 추출 전략 완벽 가이드](./reflector-deep-dive.md) (작성 예정)
- [03. DiscoveryService를 이용한 전역 프로바이더 탐색 및 조작](./discovery-service.md) (작성 예정)
- [04. 실전: 우리 팀만의 강력한 커스텀 데코레이터 설계하기](./designing-custom-decorators.md) (작성 예정)
