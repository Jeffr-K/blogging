# LSP — 리스코프 치환 원칙 (Liskov Substitution Principle)

> "프로그램의 객체는 프로그램의 정확성을 깨뜨리지 않으면서
>  하위 타입의 인스턴스로 바꿀 수 있어야 한다."
> — Barbara Liskov

---

## 핵심 개념

상위 타입을 사용하는 코드가 하위 타입으로 교체되어도 동일하게 동작해야 한다.

```
LSP를 한 문장으로:
"IS-A 관계는 행동으로 정의된다. 구조가 아니라."

직사각형 IS-A 도형 ✅
정사각형 IS-A 직사각형 → 행동이 달라지면 ❌
```

---

## 위반 예제 1 — 직사각형과 정사각형 (고전 예제)

```kotlin
open class Rectangle {
    open var width: Int = 0
    open var height: Int = 0

    fun area(): Int = width * height
}

// "정사각형은 직사각형이다" — 구조적으로는 맞지만 행동이 다르다
class Square : Rectangle() {
    override var width: Int = 0
        set(value) { field = value; super.height = value }  // 높이도 같이 변경

    override var height: Int = 0
        set(value) { field = value; super.width = value }  // 너비도 같이 변경
}

// 상위 타입을 사용하는 코드
fun setDimensions(rect: Rectangle, width: Int, height: Int) {
    rect.width = width
    rect.height = height
    // Rectangle: width=5, height=3 → area=15 예상
    // Square:    width=3, height=3 → area=9  실제 (LSP 위반!)
    assert(rect.area() == width * height)  // Square에서 실패
}
```

**왜 위반인가:** `Rectangle`을 기대하는 코드에 `Square`를 넣으면 assertion이 깨진다.

### 해결 — 행동이 다르면 계층 구조를 바꾼다

```kotlin
// 공통 인터페이스로 상위 타입 정의
interface Shape {
    fun area(): Int
}

// 계층 관계 제거 — 각자 독립
class Rectangle(val width: Int, val height: Int) : Shape {
    override fun area() = width * height
}

class Square(val side: Int) : Shape {
    override fun area() = side * side
}
```

---

## 위반 예제 2 — 예외 추가

```kotlin
open class FileReader {
    open fun read(path: String): String {
        return File(path).readText()
    }
}

// 읽기 전용 디렉터리에서만 읽는 제한된 구현
class RestrictedFileReader : FileReader() {
    private val allowedDirectory = "/safe"

    override fun read(path: String): String {
        // 상위 타입 계약에 없는 새 예외를 던짐 — LSP 위반
        if (!path.startsWith(allowedDirectory)) {
            throw SecurityException("허용되지 않은 경로: $path")
        }
        return super.read(path)
    }
}

// FileReader를 사용하는 코드
fun processFile(reader: FileReader, path: String) {
    val content = reader.read(path)  // RestrictedFileReader면 SecurityException 발생 가능
    // ...
}
```

**위반 이유:** 상위 타입의 계약(선행 조건)을 강화했다. `FileReader.read()`는 어떤 경로든 읽을 수 있다고 암시하지만, 하위 타입은 이를 제한한다.

### 해결 — 별도 인터페이스로 계약을 명확히

```kotlin
interface FileReader {
    fun read(path: String): String
}

// 모든 경로 가능
class UnrestrictedFileReader : FileReader {
    override fun read(path: String) = File(path).readText()
}

// 안전 경로만 — 다른 인터페이스나 팩토리로 구분
class RestrictedFileReader(private val allowedDirectory: String) : FileReader {
    override fun read(path: String): String {
        require(path.startsWith(allowedDirectory)) {
            "허용되지 않은 경로: $path"
        }
        return File(path).readText()
    }
}
```

---

## 실전 예제 — 알림 서비스

```kotlin
interface NotificationSender {
    // 계약: message를 보낸다. 실패 시 NotificationException 던짐.
    fun send(to: String, message: String)
}

class EmailSender(private val mailClient: MailClient) : NotificationSender {
    override fun send(to: String, message: String) {
        mailClient.sendEmail(to, message)
    }
}

class SmsSender(private val smsClient: SmsClient) : NotificationSender {
    override fun send(to: String, message: String) {
        // LSP 준수: 같은 계약, 다른 구현
        smsClient.sendSms(to, message)
    }
}

// LSP를 위반하는 구현
class SilentSender : NotificationSender {
    override fun send(to: String, message: String) {
        // 아무것도 안 함 — 행동이 다름 (테스트 용도로만 사용)
        // 프로덕션 코드에서 교체하면 알림이 묵음됨 → LSP 위반
    }
}

// 올바른 테스트용 구현
class RecordingNotificationSender : NotificationSender {
    val sentMessages = mutableListOf<Pair<String, String>>()

    override fun send(to: String, message: String) {
        sentMessages.add(to to message)
        // "보냈다"는 계약은 준수 (기록으로 확인 가능)
    }
}
```

---

## LSP와 Spring 상속

### 위반: @Transactional 메서드 오버라이드

```kotlin
@Service
open class OrderService(private val orderRepository: OrderRepository) {

    @Transactional
    open fun confirm(orderId: Long): Order {
        val order = orderRepository.findById(orderId) ?: throw NotFoundException()
        order.confirm()
        return orderRepository.save(order)
    }
}

// 하위 클래스에서 트랜잭션 없이 오버라이드
@Service
class FastOrderService(orderRepository: OrderRepository) : OrderService(orderRepository) {

    // @Transactional 없음 — 상위 타입의 트랜잭션 보장 위반
    override fun confirm(orderId: Long): Order {
        // 트랜잭션 없이 실행 → 데이터 일관성 깨질 수 있음
        return super.confirm(orderId)
    }
}
```

**해결:** 상속 대신 인터페이스 + 컴포지션

```kotlin
interface OrderConfirmationService {
    fun confirm(orderId: Long): Order
}

@Service
class StandardOrderService(
    private val orderRepository: OrderRepository
) : OrderConfirmationService {

    @Transactional
    override fun confirm(orderId: Long): Order {
        val order = orderRepository.findById(orderId) ?: throw NotFoundException()
        order.confirm()
        return orderRepository.save(order)
    }
}

@Service
class PriorityOrderService(
    private val orderRepository: OrderRepository,
    private val priorityQueue: PriorityQueue,
) : OrderConfirmationService {

    @Transactional
    override fun confirm(orderId: Long): Order {
        val order = orderRepository.findById(orderId) ?: throw NotFoundException()
        order.confirm()
        priorityQueue.push(order)  // 추가 처리
        return orderRepository.save(order)
    }
}
```

---

## LSP 검증 — 동일한 테스트로 모든 구현체 테스트

LSP를 잘 지키고 있다면 상위 타입에 대한 테스트를 모든 구현체에 재사용할 수 있다.

```kotlin
// 상위 타입 계약을 테스트하는 추상 테스트
abstract class NotificationSenderContractTest {
    abstract fun createSender(): NotificationSender

    @Test
    fun `유효한 수신자에게 메시지를 보낸다`() {
        val sender = createSender()
        // 예외 없이 실행되어야 함
        shouldNotThrowAny { sender.send("user@example.com", "테스트 메시지") }
    }

    @Test
    fun `빈 메시지도 허용한다`() {
        val sender = createSender()
        shouldNotThrowAny { sender.send("user@example.com", "") }
    }

    @Test
    fun `수신자가 null이면 예외`() {
        val sender = createSender()
        shouldThrow<IllegalArgumentException> {
            sender.send("", "메시지")
        }
    }
}

// 각 구현체는 계약 테스트를 상속하고 구현체별 추가 테스트만 작성
class EmailSenderTest : NotificationSenderContractTest() {
    override fun createSender() = EmailSender(mockk(relaxed = true))

    @Test
    fun `이메일 클라이언트가 호출된다`() {
        val mailClient = mockk<MailClient>(relaxed = true)
        val sender = EmailSender(mailClient)

        sender.send("user@example.com", "메시지")

        verify { mailClient.sendEmail(any(), any()) }
    }
}

class SmsSenderTest : NotificationSenderContractTest() {
    override fun createSender() = SmsSender(mockk(relaxed = true))
}
```

이 패턴으로 모든 구현체가 동일한 계약을 만족하는지 자동 검증된다.

---

## LSP 체크리스트

```
하위 타입 구현 시 확인:
□ 상위 타입이 던지지 않는 새 예외를 추가하지 않았는가?
□ 반환값의 타입/범위가 상위 타입보다 좁아지지 않았는가?
□ 선행 조건(precondition)을 강화하지 않았는가?
□ 후행 조건(postcondition)을 약화하지 않았는가?
□ 상위 타입의 불변식(invariant)을 유지하는가?
```

---

## 정리

| | LSP 위반 | LSP 준수 |
|---|----------|----------|
| 다형성 사용 | 런타임 오류 가능 | 안전함 |
| 테스트 | 구현체마다 다르게 작성 | 계약 테스트 재사용 |
| 코드 이해 | 타입별 분기 처리 필요 | 타입을 신뢰하고 사용 |
| 확장 | 교체 시 동작 보장 불확실 | 교체 후에도 동작 보장 |

**실천 팁:**
- 상속보다 인터페이스 + 컴포지션을 선호한다
- 하위 클래스에서 상위 메서드가 `throw`를 추가한다면 경고 신호
- 추상 계약 테스트(Contract Test)로 LSP를 자동 검증한다
