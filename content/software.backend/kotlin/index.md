# Kotlin 2.0+ 완전 학습 인덱스

---

## 1. 기초 문법

### 패키지 & 임포트
- 패키지 선언
- 임포트 (`import`, `import as` 별칭)
- 최상위 선언 (Top-level Declaration)

### 변수
- `val` — 불변 참조
- `var` — 가변 참조
- `const val` — 컴파일 타임 상수
- 타입 추론

### 기본 타입
- 정수형: `Byte`, `Short`, `Int`, `Long`
- 부동소수: `Float`, `Double`
- `Boolean`
- `Char`
- `String`
- `Any` — 모든 타입의 루트
- `Unit` — 반환값 없음 (Java `void` 대응)
- `Nothing` — 정상 반환 없음 (예외, 무한루프)

### 문자열
- 문자열 템플릿 (`$`, `${}`)
- 멀티라인 문자열 (`"""`)
- `trimIndent` / `trimMargin`
- 멀티 달러 보간 (`$$`) — Kotlin 2.0

### 배열
- `Array<T>`
- 원시 타입 배열: `IntArray`, `LongArray`, `DoubleArray`, `BooleanArray` 등
- `arrayOf`, `intArrayOf`, `emptyArray`

### 범위(Range)와 진행(Progression)
- `..` — 닫힌 범위 (1..10)
- `..<` — 열린 범위 (1..<10)
- `until` — 열린 범위 (1 until 10)
- `downTo` — 내림차순
- `step` — 간격
- `in` / `!in` — 포함 여부

### 구조 분해 선언 (Destructuring Declaration)
- `val (a, b) = pair`
- `_` — 사용하지 않는 컴포넌트 무시
- `componentN()` 관례
- 람다 파라미터 구조 분해

### 스프레드 연산자
- `*` — 배열을 vararg에 펼치기

---

## 2. Null 안전성

- Nullable 타입 (`T?`)
- 안전 호출 연산자 (`?.`)
- 엘비스 연산자 (`?:`)
- Not-null 단언 (`!!`)
- 안전 캐스트 (`as?`)
- `let` + `?.` 패턴
- `also`, `run`, `apply` + null 체크
- `requireNotNull` / `checkNotNull`
- `requireNotNull` vs `!!` 차이
- 플랫폼 타입 (Platform Type) — Java 상호운용 시
- 확정 비-nullable 타입 (`T & Any`) — Kotlin 1.7+

---

## 3. 제어 흐름

### if
- `if` 표현식 (값 반환)
- `if-else if-else`

### when
- `when` 표현식 (값 반환)
- 인자 있는 `when` / 없는 `when`
- 다중 조건 (`1, 2 ->`)
- 범위 조건 (`in 1..10`)
- 타입 체크 (`is String`)
- 가드 조건 (`when (x) { y if condition -> }`) — Kotlin 2.0
- `when` + 스마트 캐스트

### 반복
- `for` — 반복자(Iterator) 관례
- `while` / `do-while`
- `repeat(n)`

### 점프
- `break` / `continue`
- 레이블 `break` (`break@label`)
- 레이블 `continue` (`continue@label`)
- 레이블 `return` (`return@label`)
- 비지역 break/continue (inline lambda) — Kotlin 2.0

### 예외
- `throw` 표현식
- `try-catch-finally` 표현식 (값 반환)
- `runCatching` / `getOrElse` / `getOrThrow`

---

## 4. 함수 종류

### 일반 함수
- 함수 선언 (`fun`)
- 기본 매개변수 (Default Parameters)
- 명명 인자 (Named Arguments)
- `vararg` — 가변 인자
- 단일 표현식 함수 (`fun foo() = ...`)

### 지역 함수 (Local Function)
- 함수 안에 함수 정의
- 외부 함수의 변수 캡처

### 확장 함수 (Extension Function)
- 기존 타입에 함수 추가
- 확장 함수 vs 멤버 함수 우선순위
- Nullable 수신 객체 확장 함수
- 확장 함수의 정적 디스패치

### 확장 프로퍼티 (Extension Property)
- 기존 타입에 프로퍼티 추가
- backing field 없음

### 인라인 함수 (inline)
- `inline fun` — 호출 지점에 본문 인라인
- `noinline` — 특정 람다를 인라인 제외
- `crossinline` — 비지역 return 금지
- `reified` — 인라인 함수에서 타입 파라미터 구체화

### 고차 함수 (Higher-order Function)
- 함수를 인자로 받기
- 함수를 반환하기
- 함수 타입 (`(A) -> B`, `(A, B) -> C`, `() -> Unit`)

### 람다 표현식
- `{ params -> body }`
- `it` — 단일 파라미터 암시적 이름
- 후행 람다 (Trailing Lambda)
- 람다에서의 `return` (비지역 return)

### 익명 함수 (Anonymous Function)
- `fun(x: Int): Int { return x * 2 }`
- 람다와의 차이 (return 동작)

### 수신 객체 지정 람다 (Function with Receiver)
- `TypeName.() -> Unit`
- `this`로 수신 객체 접근
- DSL의 기반

### 인픽스 함수 (infix)
- `infix fun` — 중위 표기 호출
- `1 to "one"`, `a xor b`

### 연산자 함수 (operator)
- `operator fun` — 연산자 오버로딩
- 산술: `plus`, `minus`, `times`, `div`, `rem`
- 단항: `unaryPlus`, `unaryMinus`, `not`, `inc`, `dec`
- 비교: `compareTo`
- 동등: `equals`
- 인덱스: `get`, `set`
- 포함: `contains` (`in`)
- 범위: `rangeTo`, `rangeUntil`
- 구조 분해: `componentN`
- 호출: `invoke`
- 위임: `getValue`, `setValue`, `provideDelegate`

### suspend 함수
- `suspend fun` — 코루틴 내에서만 호출 가능
- 일시 중단 지점 (Suspension Point)

### tailrec 함수
- `tailrec fun` — 꼬리 재귀 최적화
- 스택 오버플로 방지

### 컨텍스트 수신 객체 / 컨텍스트 파라미터
- `context(A, B)` — 여러 수신 객체 선언 (Context Receivers, `-Xcontext-receivers`, Kotlin 1.6.20~2.x 실험적)
- 컨텍스트 파라미터 (Context Parameters) — Kotlin 2.2+ 새 설계 (`context(name: Type)`)
- 의존성 주입 대체 — 로깅, 트랜잭션, 권한 컨텍스트
- DSL 스코프 정제

### 함수 참조 (Function Reference)
- `::functionName`
- `instance::method`
- `Type::method`
- `::constructor`

---

## 5. 클래스 종류

### class — 일반 클래스
- 클래스 선언
- 주 생성자 (Primary Constructor)
- `init` 블록
- 부 생성자 (Secondary Constructor) — `constructor()`
- `this()` 위임
- 프로퍼티 선언 위치 (생성자 vs 본문)

### abstract class — 추상 클래스
- `abstract fun` / `abstract val`
- 인스턴스 생성 불가
- 구현 강제

### open class — 상속 가능 클래스
- Kotlin 기본은 `final`
- `open`으로 상속 허용
- `open fun` — 오버라이드 허용

### data class — 데이터 클래스
- 자동 생성: `equals`, `hashCode`, `toString`, `copy`, `componentN`
- `copy()` — 일부 프로퍼티만 변경한 복사본
- 구조 분해 (`val (name, age) = user`)
- 주 생성자에 `val`/`var` 필수
- 상속 불가 (Kotlin 1.x), sealed data class 가능 (2.x)

### value class — 값 클래스
- `@JvmInline value class`
- 단일 프로퍼티만 허용
- 런타임 박싱/언박싱 최소화
- 타입 안전 래퍼 패턴
- 인터페이스 구현 가능
- 제약사항 (backing field, init 블록 등)

### sealed class — 봉인 클래스
- 제한된 클래스 계층
- `when`에서 완전성 검사 (exhaustive)
- 같은 패키지/파일에 서브클래스 제한 (Kotlin 1.x) → 같은 모듈 (Kotlin 1.5+)
- 서브클래스: `class`, `object`, `data class` 등 가능

### sealed interface — 봉인 인터페이스
- `sealed class`와 동일한 완전성 보장
- 다중 구현 가능 (sealed class와 차이)
- 더 유연한 계층 구성

### enum class — 열거형 클래스
- 열거 상수 선언
- 프로퍼티 / 메서드 정의
- `abstract` 메서드 (각 상수에서 구현)
- `entries` — 모든 상수 리스트 (Kotlin 2.0, `values()` 대체)
- `ordinal` / `name`
- `valueOf(String)` / `enumValueOf<T>(String)`
- `enumValues<T>()`

### annotation class — 애노테이션 클래스
- `@Target` — 적용 대상 지정
- `@Retention` — 유지 범위 (SOURCE / BINARY / RUNTIME)
- `@Repeatable` — 반복 적용 허용
- `@MustBeDocumented`
- 파라미터 타입 제약 (원시 타입, String, KClass, enum, annotation, 배열만 가능)

### fun interface — 함수형 인터페이스 (SAM)
- 단일 추상 메서드
- 람다로 인스턴스 생성 가능 (SAM 변환)
- Java `@FunctionalInterface`와 대응

### inner class — 내부 클래스
- `inner class` — 외부 클래스 인스턴스 참조 보유
- `this@OuterClass` — 외부 클래스 참조
- vs 중첩 클래스(nested class) — `inner` 없으면 정적 중첩

### nested class — 중첩 클래스
- `class Outer { class Nested }` — `inner` 키워드 없음
- 외부 클래스 인스턴스 참조 없음
- Java의 `static` 내부 클래스에 대응

### object — 객체 선언 (싱글톤)
- `object Name { }` — 선언과 동시에 인스턴스 생성
- 인터페이스 / 추상 클래스 구현 가능
- 지연 초기화 (첫 접근 시)

### companion object — 동반 객체
- `companion object { }` — 클래스에 귀속된 싱글톤
- 팩토리 메서드 패턴
- `@JvmStatic` — Java 정적 메서드로 노출
- `@JvmField` — Java 정적 필드로 노출
- 이름 지정 가능 (`companion object Factory`)
- 확장 함수 on companion object

### data object — 데이터 객체 (Kotlin 2.0)
- `data object` — `toString`, `equals`, `hashCode` 자동 생성
- 직렬화 친화적 싱글톤
- sealed 계층의 단말 노드로 활용

### interface — 인터페이스
- 추상 메서드 / 프로퍼티
- 디폴트 메서드 구현
- 다중 구현
- 인터페이스 충돌 해결 (`super<Interface>.method()`)
- 인터페이스에 상태 없음 (backing field 없음)

### Anonymous Object — 익명 객체
- `object : Interface { }` — 일회성 구현
- `object : AbstractClass() { }` — 추상 클래스 구현
- 로컬 변수 캡처 가능 (람다와 유사)

---

## 6. 수정자(Modifier) 키워드 완전 정리

### 가시성 수정자
- `public` — 기본값, 모든 곳에서 접근 가능
- `private` — 선언된 파일/클래스 내부만
- `protected` — 클래스 및 서브클래스
- `internal` — 같은 모듈 내

### 상속 수정자
- `final` — 오버라이드/상속 금지 (기본값)
- `open` — 상속/오버라이드 허용
- `abstract` — 구현 없음, 반드시 오버라이드
- `override` — 부모의 멤버 재정의
- `sealed` — 제한된 계층

### 클래스 수정자
- `data` — data class
- `inner` — 외부 클래스 참조 보유 내부 클래스
- `value` — 값 클래스 (with `@JvmInline`)
- `enum` — 열거형
- `annotation` — 애노테이션

### 함수/프로퍼티 수정자
- `const` — 컴파일 타임 상수 (top-level 또는 companion object)
- `lateinit` — 나중에 초기화되는 `var`
- `operator` — 연산자 오버로딩
- `infix` — 중위 표기 허용
- `inline` — 호출 지점에 인라인
- `noinline` — 인라인 함수의 특정 람다 인라인 제외
- `crossinline` — 비지역 return 금지
- `tailrec` — 꼬리 재귀 최적화
- `suspend` — 코루틴 일시 중단 가능
- `external` — 플랫폼 외부 구현 (JS, Native)

### 타입 파라미터 수정자
- `reified` — 인라인 함수에서 타입 구체화
- `out` — 공변 (covariant, 생산자)
- `in` — 반변 (contravariant, 소비자)

### 멀티플랫폼 수정자
- `expect` — 플랫폼별 구현을 요구하는 선언
- `actual` — `expect`에 대한 실제 플랫폼 구현

---

## 7. 프로퍼티

### 기본
- `val` 프로퍼티 — getter만
- `var` 프로퍼티 — getter + setter
- Backing field (`field` 키워드)
- Custom getter
- Custom setter
- `private set` — 외부에서 쓰기 금지

### 특수 프로퍼티
- `const val` — 컴파일 타임 상수
- `lateinit var` — 나중 초기화, `isInitialized` 체크
- `by lazy` — 첫 접근 시 초기화 (기본 스레드 안전)
- `by lazy(LazyThreadSafetyMode.NONE)` — 단일 스레드용
- 확장 프로퍼티 — backing field 없음

### 위임 프로퍼티 (Delegated Property)
- `by` 키워드
- `by lazy {}` — 지연 초기화
- `by observable {}` — 변경 감지
- `by vetoable {}` — 변경 거부 가능
- `by Delegates.notNull()` — null 불허 나중 초기화
- `by map` — Map에서 값 읽기
- 커스텀 위임 — `ReadOnlyProperty`, `ReadWriteProperty` 구현
- `provideDelegate` — 위임 생성 시 검증

---

## 8. 상속 & 인터페이스

### 상속
- 단일 상속 (`class Child : Parent()`)
- `super()` / `super.method()`
- `open` 클래스만 상속 가능
- 오버라이드 — `override`
- 오버라이드 금지 — `final override`
- 생성자 위임 — 주/부 생성자에서 `super()`

### 인터페이스 구현
- 다중 구현 가능
- 추상 프로퍼티 구현
- 디폴트 메서드 재정의
- 다이아몬드 문제 해결 — `super<InterfaceName>.method()`

### 클래스 위임 (Class Delegation)
- `class Impl : Interface by delegate` — 구현을 위임
- 데코레이터 패턴 간소화

---

## 9. 제네릭 & 변성

### 제네릭 기초
- 제네릭 클래스 (`class Box<T>`)
- 제네릭 함수 (`fun <T> func()`)
- 타입 파라미터 제약 — 상한 (`<T : Comparable<T>>`)
- 다중 제약 (`where T : Serializable, T : Comparable<T>`)
- Nullable 제약 (`<T : Any?>` vs `<T : Any>`)

### 변성 (Variance)
- 공변 `out T` — 선언 지점 변성, 생산자 (읽기만)
- 반변 `in T` — 선언 지점 변성, 소비자 (쓰기만)
- 무변 (기본) — 읽기/쓰기 모두
- 사용 지점 변성 (`fun copy(from: Array<out T>, to: Array<T>)`)
- 스타 프로젝션 (`Array<*>`) — 타입 모름

### 고급
- `reified` 타입 파라미터 — 런타임 타입 접근
- `typeOf<T>()` — KType 획득
- 확정 비-nullable 타입 (`T & Any`) — Kotlin 1.7+

---

## 10. 컬렉션

### 불변 컬렉션
- `List<T>` — `listOf`, `emptyList`
- `Set<T>` — `setOf`, `linkedSetOf`, `sortedSetOf`
- `Map<K, V>` — `mapOf`, `linkedMapOf`, `sortedMapOf`

### 가변 컬렉션
- `MutableList<T>` — `mutableListOf`, `ArrayList`
- `MutableSet<T>` — `mutableSetOf`, `HashSet`, `LinkedHashSet`, `TreeSet`
- `MutableMap<K, V>` — `mutableMapOf`, `HashMap`, `LinkedHashMap`, `TreeMap`

### 빌더
- `buildList { }`, `buildSet { }`, `buildMap { }`

### 특수 컬렉션
- `ArrayDeque<T>` — 양방향 큐
- `PriorityQueue<T>` — Java 위임
- `Pair<A, B>` / `Triple<A, B, C>`

### 컬렉션 API — 변환
- `map`, `mapNotNull`, `mapIndexed`
- `flatMap`, `flatten`
- `filter`, `filterNotNull`, `filterIsInstance`
- `filterIndexed`
- `associate`, `associateBy`, `associateWith`
- `groupBy`
- `partition` — 두 리스트로 분리
- `zip`, `unzip`
- `chunked` — N개씩 묶기
- `windowed` — 슬라이딩 윈도우

### 컬렉션 API — 집계
- `reduce`, `fold`, `foldRight`
- `runningFold`, `runningReduce` (scan)
- `sum`, `sumOf`
- `average`
- `count`, `count { predicate }`
- `min`, `max`, `minOrNull`, `maxOrNull`
- `minBy`, `maxBy`, `minByOrNull`, `maxByOrNull`
- `minOf`, `maxOf`

### 컬렉션 API — 검색
- `find`, `findLast`
- `first`, `last`, `firstOrNull`, `lastOrNull`
- `single`, `singleOrNull`
- `any`, `all`, `none`
- `contains`, `containsAll`
- `indexOf`, `lastIndexOf`, `indexOfFirst`, `indexOfLast`

### 컬렉션 API — 정렬
- `sorted`, `sortedDescending`
- `sortedBy`, `sortedByDescending`
- `sortedWith` — Comparator
- `reversed`, `asReversed`
- `shuffled`

### 컬렉션 API — 기타
- `take`, `takeLast`, `takeWhile`, `takeLastWhile`
- `drop`, `dropLast`, `dropWhile`, `dropLastWhile`
- `distinct`, `distinctBy`
- `plus` (`+`), `minus` (`-`)
- `intersect`, `union`, `subtract`
- `flatten`
- `joinToString`
- `toList`, `toSet`, `toMap`, `toMutableList` 등

---

## 11. 시퀀스 (Sequence)

- `sequenceOf`, `asSequence()`
- `sequence { }` 빌더 — `yield`, `yieldAll`
- `generateSequence` — 무한 시퀀스
- 지연 평가 (Lazy Evaluation) — 중간 연산 지연
- 중간 연산 vs 최종 연산
- 시퀀스 vs 컬렉션 성능 비교
- `constrainOnce()` — 단일 소비 시퀀스

---

## 12. 스코프 함수

| 함수 | 수신 객체 | 반환값 |
|------|----------|--------|
| `let` | `it` | 람다 결과 |
| `run` | `this` | 람다 결과 |
| `with` | `this` | 람다 결과 |
| `apply` | `this` | 수신 객체 |
| `also` | `it` | 수신 객체 |

- `let` — null 체크, 결과 변환
- `run` — 초기화 블록, 계산 후 반환
- `with` — 수신 객체를 인자로 받음 (확장 함수 아님)
- `apply` — 객체 설정 후 반환
- `also` — 부수 효과 (로깅 등), 체이닝
- `takeIf`, `takeUnless` — 조건부 반환

---

## 13. 코루틴 기초

### 개념
- 코루틴이란 — 경량 스레드
- `suspend` 함수
- 일시 중단(Suspension)과 재개(Resume)
- 코루틴 vs 스레드

### 코루틴 빌더
- `launch` — fire-and-forget, `Job` 반환
- `async` — 결과 필요, `Deferred<T>` 반환
- `runBlocking` — 코루틴 진입점 (테스트/main)
- `coroutineScope` — 자식 코루틴 대기
- `supervisorScope` — 자식 실패 독립

### CoroutineScope & CoroutineContext
- `CoroutineScope`
- `CoroutineContext` — 컨텍스트 요소들의 집합
- `Job` — 코루틴 생명주기
- `CoroutineName` — 디버깅용 이름
- `+` 연산자로 컨텍스트 합성

### Dispatchers
- `Dispatchers.Default` — CPU 집약 작업
- `Dispatchers.IO` — I/O 작업
- `Dispatchers.Main` — UI 스레드 (Android 등)
- `Dispatchers.Unconfined` — 제한 없음
- `newSingleThreadContext` — 전용 스레드
- `withContext` — 디스패처 전환

---

## 14. 구조적 동시성 & 취소

### Job 생명주기
- `Job` 상태: New → Active → Completing → Completed / Cancelling → Cancelled
- `Job.join()` — 완료 대기
- `Deferred.await()` — 결과 대기
- `SupervisorJob` — 자식 실패가 부모에 영향 없음

### 취소 (Cancellation)
- `job.cancel()`
- `isActive` 체크
- `ensureActive()`
- `yield()` — 취소 체크 + 양보
- `CancellationException`
- `NonCancellable` — 취소 불가 코드 블록

### 타임아웃
- `withTimeout` — 초과 시 `TimeoutCancellationException`
- `withTimeoutOrNull` — 초과 시 `null` 반환

### 예외 처리
- `CoroutineExceptionHandler`
- `launch` — 예외 즉시 전파
- `async` — `await()` 호출 시 예외 전파
- 자식 코루틴 예외 전파 규칙

---

## 15. Flow

### Cold Flow
- `flow { emit(...) }` 빌더
- `flowOf`, `asFlow`
- `collect` — 최종 연산
- Cold Flow 특성 — 구독마다 새로 실행

### 중간 연산자
- `map`, `mapNotNull`
- `filter`
- `transform` — 유연한 변환
- `take`, `takeWhile`
- `drop`, `dropWhile`
- `onEach` — 부수 효과
- `debounce`, `throttleFirst` (kotlinx.coroutines.flow)
- `distinctUntilChanged`, `distinctUntilChangedBy`
- `flatMapConcat`, `flatMapMerge`, `flatMapLatest`
- `combine`, `zip`
- `buffer` — 버퍼링
- `conflate` — 최신 값만 처리
- `flowOn` — 업스트림 디스패처 변경

### 생명주기 연산자
- `onStart`
- `onCompletion`
- `catch` — 에러 처리
- `retry`, `retryWhen`

### 최종 연산자
- `collect`, `collectLatest`
- `first`, `firstOrNull`, `last`, `lastOrNull`
- `single`, `singleOrNull`
- `toList`, `toSet`
- `fold`, `reduce`
- `launchIn` — 코루틴 스코프에서 수집

### Hot Flow
- `StateFlow<T>` — 현재 상태 보유, 항상 최신값
- `MutableStateFlow`
- `SharedFlow<T>` — 여러 구독자, replay 설정 가능
- `MutableSharedFlow`
- `stateIn`, `shareIn` — Cold → Hot 변환

### 특수 빌더
- `callbackFlow` — 콜백 기반 API → Flow
- `channelFlow` — 채널 기반 Flow

---

## 16. 채널 (Channel)

- `Channel<T>` 생성
- `send` / `receive`
- `trySend` / `tryReceive`
- `close` / `isClosedForSend` / `isClosedForReceive`
- 채널 타입:
  - `RENDEZVOUS` — 버퍼 없음 (기본)
  - `BUFFERED` — 고정 버퍼
  - `UNLIMITED` — 무제한 버퍼
  - `CONFLATED` — 최신값만 유지
- `produce { }` — 채널 생산자 코루틴
- `consumeEach` — 채널 소비
- `actor { }` — 채널 소비자 코루틴
- `select { }` — 여러 채널 동시 대기

---

## 17. 동시성 도구

- `Mutex` — 상호 배제
- `Mutex.withLock { }` — 안전한 lock 획득
- `Semaphore` — 동시 접근 수 제한
- `AtomicInt`, `AtomicLong`, `AtomicBoolean`, `AtomicReference` (Java Atomic)
- `@Volatile` — JVM volatile
- `ThreadLocal` + `asContextElement()` — 코루틴 로컬

---

## 18. 위임 (Delegation)

### 클래스 위임
- `class Impl : Interface by delegate`
- 특정 메서드만 오버라이드

### 프로퍼티 위임
- `val x by SomeDelegate()`
- `by lazy { }` — thread-safe 지연 초기화
- `by lazy(mode) { }` — SYNCHRONIZED / PUBLICATION / NONE
- `by Delegates.observable { old, new -> }` — 변경 감지
- `by Delegates.vetoable { old, new -> bool }` — 변경 거부
- `by Delegates.notNull<T>()` — lateinit 대안
- `by map` — Map에서 프로퍼티 읽기
- 커스텀 위임 구현 — `getValue` / `setValue`
- `ReadOnlyProperty<R, T>` 인터페이스
- `ReadWriteProperty<R, T>` 인터페이스
- `provideDelegate` — 위임 생성 시 추가 로직

---

## 19. 연산자 오버로딩 완전 정리

| 연산자 | 함수 이름 |
|--------|---------|
| `a + b` | `plus` |
| `a - b` | `minus` |
| `a * b` | `times` |
| `a / b` | `div` |
| `a % b` | `rem` |
| `+a` | `unaryPlus` |
| `-a` | `unaryMinus` |
| `!a` | `not` |
| `a++` | `inc` |
| `a--` | `dec` |
| `a == b` | `equals` |
| `a > b` 등 | `compareTo` |
| `a[i]` | `get` |
| `a[i] = b` | `set` |
| `a in b` | `contains` |
| `a..b` | `rangeTo` |
| `a..<b` | `rangeUntil` |
| `a(args)` | `invoke` |
| `val (a, b) = x` | `component1`, `component2` |
| `a += b` | `plusAssign` |

---

## 20. DSL & 타입 안전 빌더

- 수신 객체 지정 람다 기반 DSL
- `@DslMarker` — 중첩 스코프에서 잘못된 수신 객체 접근 방지
- `invoke` 관례 활용
- HTML/SQL/설정 DSL 구현 예시
- Gradle Kotlin DSL 이해

---

## 21. 타입 시스템 고급

- 스마트 캐스트 심화 — `is` 체크 후 자동 캐스트
- 스마트 캐스트 불가 케이스 (가변 프로퍼티 등)
- K2 컴파일러의 스마트 캐스트 개선 (Kotlin 2.0)
- 타입 별칭 (`typealias`) — 복잡한 타입에 이름 부여
- 함수 타입 별칭
- `Nothing` 활용 — `TODO()`, `error()`, `throw`
- 교차 타입 (`T & Any`)
- 공변 반환 타입

---

## 22. 표준 라이브러리 유틸리티

### 체크 & 전제 조건
- `require(condition)` / `requireNotNull(value)`
- `check(condition)` / `checkNotNull(value)`
- `error(message)` — `Nothing` 반환
- `TODO(message)` — 미구현 마커

### Result<T>
- `runCatching { }` — 예외를 Result로
- `getOrNull`, `getOrElse`, `getOrThrow`, `getOrDefault`
- `map`, `mapCatching`, `recover`, `recoverCatching`
- `onSuccess`, `onFailure`
- `isSuccess`, `isFailure`

### 수학
- `kotlin.math.*` — `abs`, `sqrt`, `pow`, `ceil`, `floor`, `round`
- `coerceIn`, `coerceAtLeast`, `coerceAtMost`

### 시간 (kotlin.time)
- `Duration` — `seconds`, `milliseconds`, `minutes`
- `measureTime`, `measureTimedValue`
- `TimeSource`

### 기타
- `repeat(n) { }` — n번 반복
- `buildString { }` / `StringBuilder`
- `Random` / `Random.nextInt(range)`
- `DeepRecursiveFunction` — 스택 안전 재귀

---

## 23. 직렬화 (kotlinx.serialization)

- `@Serializable` 애노테이션
- `Json.encodeToString` / `Json.decodeFromString`
- `@SerialName` — 필드명 변경
- `@Transient` — 직렬화 제외
- `@Required` — 필수 필드 강제
- `@EncodeDefault` — 기본값 포함/제외
- 다형성 직렬화 (`@Polymorphic`, `SerializersModule`)
- sealed class 직렬화
- 커스텀 직렬라이저 (`KSerializer<T>`)
- 포맷: `Json`, `Cbor`, `Protobuf`
- Json 설정 — `prettyPrint`, `ignoreUnknownKeys`, `isLenient`

---

## 24. 리플렉션

- `KClass<T>` — `T::class`, `obj::class`
- `KFunction` — 함수 메타데이터
- `KProperty` — 프로퍼티 메타데이터
- `KType` — 타입 메타데이터
- `KParameter`
- `::functionName` — 함수 참조
- `::propertyName` — 프로퍼티 참조
- `typeOf<T>()` — KType 획득 (reified 불필요)
- `createInstance()` — 기본 생성자로 인스턴스 생성
- `callBy` — 이름으로 파라미터 전달

---

## 25. 애노테이션

### 표준 애노테이션
- `@Deprecated` + `ReplaceWith`
- `@Suppress`
- `@OptIn` / `@RequiresOptIn` — 실험적 API 관리
- `@SubclassOptInRequired` — Kotlin 2.0
- `@JvmStatic`, `@JvmField`, `@JvmOverloads`, `@JvmName`
- `@JvmInline` — value class
- `@Throws` — Java 예외 선언
- `@Volatile`, `@Synchronized`
- `@Strictfp`

### 커스텀 애노테이션
- `@Target` — CLASS, FUNCTION, PROPERTY, VALUE_PARAMETER 등
- `@Retention` — SOURCE, BINARY, RUNTIME
- `@Repeatable`
- `@MustBeDocumented`
- 런타임 애노테이션 처리 (리플렉션)

---

## 26. 자바 상호운용성

### Kotlin → Java 호출
- Java 컬렉션 사용
- `null` 반환 Java 메서드 — 플랫폼 타입 처리
- Java 예외 처리
- Java `static` 멤버 접근
- Java SAM 인터페이스 → 람다 변환

### Java → Kotlin 호출
- `@JvmStatic` — companion object 메서드를 static으로
- `@JvmField` — 필드로 노출
- `@JvmOverloads` — 기본 파라미터 오버로드 생성
- `@JvmName` — JVM 이름 변경 (이름 충돌 해결)
- `@Throws` — checked 예외 선언
- 프로퍼티 → getter/setter 노출 규칙
- `internal` 수정자 — Java에서 mangled name

---

## 27. Kotlin Multiplatform (KMP)

- KMP 프로젝트 구조 (`commonMain`, `jvmMain`, `jsMain`, `nativeMain`)
- `expect` 선언 — 공통 인터페이스
- `actual` 구현 — 플랫폼별 구현
- 공통 표준 라이브러리 활용
- `kotlinx` 멀티플랫폼 라이브러리 — coroutines, serialization, datetime, io
- Kotlin/JS — DOM API, npm 의존성
- Kotlin/Native — iOS 연동, C interop
- Compose Multiplatform

---

## 28. Kotlin 2.0 신기능

### K2 컴파일러
- K2 컴파일러 아키텍처 — FIR (Frontend IR)
- 컴파일 속도 개선 (최대 2배)
- 플러그인 API 안정화
- 스마트 캐스트 개선 — 람다 내, 멤버 함수 내 흐름 분석
- 인라인 함수 내 스마트 캐스트 개선

### 언어 변경
- `when` 가드 조건 (`when (x) { y if cond -> }`)
- 비지역 break/continue in inline lambda
- 멀티 달러 문자열 보간 (`$${"$"}`)
- 열거형 `entries` — `values()` deprecated
- `data object` — singleton에 data class 의미론
- `@SubclassOptInRequired`

### KMP 안정화
- Kotlin/Wasm 베타
- iOS export 개선

---

## 29. 컴파일러 플러그인 & 코드 생성

- `kotlinx.serialization` 플러그인
- Kotlin Symbol Processing (KSP) — KAPT 대체
  - `KSProcessor` 구현
  - 심볼 탐색, 코드 생성
- `all-open` 플러그인 — `open` 없이 상속 허용 (Spring 등)
- `no-arg` 플러그인 — 인자 없는 생성자 생성 (JPA 등)
- Lombok 플러그인
- Power-assert 플러그인 (Kotlin 2.0)

---

## 30. 테스트

### kotlin.test
- `assertEquals`, `assertNotEquals`
- `assertTrue`, `assertFalse`
- `assertNull`, `assertNotNull`
- `assertIs<T>`, `assertIsNot<T>`
- `assertFailsWith<T>`
- `expect` (Kotlin/JS/Native)

### JUnit 5 + Kotlin
- `@Test`, `@BeforeEach`, `@AfterEach`
- `@ParameterizedTest`, `@MethodSource`, `@CsvSource`
- `@Nested`
- `assertThrows`

### 코루틴 테스트 (kotlinx-coroutines-test)
- `runTest` — 가상 시간에서 코루틴 실행
- `TestCoroutineScheduler`
- `advanceTimeBy`, `advanceUntilIdle`
- `runCurrent`
- `TestScope`
- `UnconfinedTestDispatcher` / `StandardTestDispatcher`
- Flow 테스트 — `turbine` 라이브러리

### MockK
- `mockk<T>()` — mock 생성
- `every { } returns` — stub
- `coEvery { } returns` — suspend 함수 stub
- `verify { }` / `coVerify { }`
- `spyk` — spy (부분 mock)
- `slot<T>()` — 인자 캡처
- `relaxed = true` — 기본 반환값 자동 설정

### Kotest
- Spec 스타일: `FunSpec`, `BehaviorSpec`, `DescribeSpec`, `StringSpec`
- Matcher: `shouldBe`, `shouldNotBe`, `shouldThrow`
- `forAll` — 프로퍼티 기반 테스트
- `withData` — 데이터 기반 테스트

---

## 31. 빌드 & 툴링

### Gradle Kotlin DSL
- `build.gradle.kts` 기본 구조
- `plugins { }` 블록
- `dependencies { }` — `implementation`, `api`, `testImplementation`
- `kotlin { }` 설정 블록
- `compilerOptions { }` — Kotlin 2.0 방식
- Task 설정

### 버전 관리
- 버전 카탈로그 (`libs.versions.toml`)
- `[versions]`, `[libraries]`, `[plugins]`, `[bundles]`

### 멀티 모듈
- `settings.gradle.kts` — `include(":module")`
- 모듈 간 의존성
- `api` vs `implementation` 노출 범위
- `buildSrc` / convention plugins

### 컴파일러 옵션
- `-opt-in`
- `-Xcontext-receivers` (실험적)
- `-progressive`
- JVM 타겟 (`jvmTarget`)

### 코드 품질
- Detekt — 정적 분석
- ktlint — 코드 포맷
- Kotlin coverage (kover)

---

## 32. 패턴 & 관용구 (Idioms)

### 코틀린 답게 쓰기
- `if`/`when` 표현식 활용
- 확장 함수로 가독성 개선
- `apply`로 객체 초기화
- `let`으로 null 안전 체이닝
- `also`로 디버그 로그 삽입

### 아키텍처 패턴
- 봉인 클래스 + `when` — 상태 머신 / 이벤트 처리
- `Result<T>` — 에러를 타입으로
- 커링 스타일 — `val handler = { dep: Dep -> { req: Req -> ... } }`
- 팩토리 패턴 — companion object + private constructor
- 빌더 패턴 — DSL / `apply`

### 동시성 패턴
- Flow 기반 이벤트 버스
- `StateFlow`로 상태 관리
- `Mutex`로 공유 자원 보호
- `actor` 패턴 — 메시지 기반 동시성

---

## 학습 순서 권장

```
1단계 — 기초
  기초 문법 → Null 안전성 → 제어 흐름 → 함수 종류 → 클래스 종류

2단계 — 핵심
  수정자 키워드 → 프로퍼티 → 상속/인터페이스 → 제네릭
  → 컬렉션 API → 시퀀스 → 스코프 함수

3단계 — 비동기
  코루틴 기초 → 구조적 동시성 → Flow → 채널

4단계 — 심화
  위임 → 연산자 오버로딩 → DSL → 타입 시스템 고급

5단계 — 실무
  직렬화 → 자바 상호운용 → 애노테이션/리플렉션
  → Kotlin 2.0 신기능 → KMP → 테스트 → 빌드

6단계 — 마무리
  컴파일러 플러그인 → 패턴/관용구 → 전체 복습
```
