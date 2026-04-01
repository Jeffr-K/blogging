# Kotlin + Spring Boot 함수형 프로그래밍 인덱스

> 이 시리즈는 [FP 핵심 개념 시리즈](/software.engineer/fp)를 전제로 합니다.
> 개념 자체보다 **Spring Boot 실무 코드베이스에 FP를 어떻게 적용하는가**에 집중합니다.

---

## 1. Kotlin FP 기초 — data class, sealed class, 불변성
- val 우선 원칙, immutable collection
- data class — copy()로 상태 변경 표현
- sealed class — 합 타입(Sum Type) 구현
- when expression — 패턴 매칭
- 기존 Java/Spring 코드와 비교

## 2. Arrow-kt 입문 — Option, Either, Raise
- Arrow-kt 라이브러리 소개
- Spring Boot 프로젝트에 Arrow 추가
- Nullable vs Option 선택 기준
- Raise DSL — Either를 더 읽기 쉽게

## 3. Either로 에러 처리하기
- 예외 던지기 대신 Either<Error, Value>
- 도메인 에러 sealed class 설계
- 서비스 레이어 → 컨트롤러 에러 전파
- Spring @ExceptionHandler와 조합

## 4. Railway Oriented Programming — Spring 서비스에 적용
- 유효성 검증 → 비즈니스 로직 → 저장 파이프라인
- flatMap 체인으로 흐름 구성
- 중간 실패 시 조기 반환 패턴

## 5. Validated — 여러 에러 동시 수집
- Either의 fail-fast vs Validated의 accumulate
- DTO 검증 시나리오 (Bean Validation과 비교)
- 여러 필드 에러를 한 번에 수집하는 패턴

## 6. 불변 도메인 모델 설계
- data class로 도메인 모델 설계
- JPA Entity와 도메인 모델 분리 전략
- copy()로 상태 변경 표현 (mutation 없이)
- Value Object 패턴

## 7. 순수 함수로 서비스 레이어 작성
- 비즈니스 로직을 순수 함수로 분리
- 부수 효과(DB, 외부 API)를 레이어 경계로 밀어내기
- Mock 없이 단위 테스트하는 방법

## 8. Scope Functions 실전 활용
- let, run, apply, also, with 차이와 선택 기준
- null-safe 처리 패턴
- Spring 빈 설정 / 체이닝에서의 활용

## 9. 확장 함수와 도메인 DSL
- 확장 함수로 도메인 DSL 구성
- Spring Security DSL / MVC DSL 구조 분석
- 커스텀 QueryDSL Builder 확장 패턴

## 10. Coroutines — 함수형 비동기 처리
- suspend 함수와 순수 함수의 관계
- Flow — 함수형 스트림 처리 (map, filter, fold)
- WebFlux vs Coroutines 선택 기준

## 11. 함수형 Spring WebFlux
- RouterFunction / HandlerFunction (함수형 라우터)
- Mono/Flux를 Either처럼 다루기
- 에러 처리: onErrorResume vs Either 조합

## 12. 실전 프로젝트 — FP 패턴 통합
- 주문 서비스 예제로 1~11편 패턴 통합
- 레이어별 FP 적용 수준 결정 기준
- 팀에 FP 도입 시 현실적인 전략
