# ISP — 인터페이스 분리 원칙 (Interface Segregation Principle)

> "클라이언트는 자신이 사용하지 않는 메서드에 의존하도록 강요받아서는 안 된다."
> — Robert C. Martin

---

## 핵심 개념

하나의 거대한 인터페이스보다 여러 개의 작고 집중된 인터페이스가 낫다.

```
ISP 위반 신호:
- 인터페이스 구현 시 "사용 안 함"이 적힌 메서드가 있다
- 구현체가 UnsupportedOperationException을 던진다
- 테스트에서 불필요한 Mock 메서드가 많다
- 인터페이스 변경이 관계없는 클래스를 깨뜨린다
```

---

## 위반 예제 — God Interface

```kotlin
// 나쁜 예: 모든 데이터 소스 기능을 하나의 인터페이스로
interface DataRepository {
    fun findById(id: Long): Any?
    fun findAll(): List<Any>
    fun save(entity: Any): Any
    fun update(entity: Any): Any
    fun delete(id: Long)
    fun count(): Long
    fun existsById(id: Long): Boolean
    fun findByPage(page: Int, size: Int): List<Any>
    fun search(query: String): List<Any>          // 검색 기능
    fun exportToCsv(): ByteArray                  // CSV 내보내기
    fun bulkInsert(entities: List<Any>)           // 대량 삽입
    fun truncate()                                // 전체 삭제
}

// 읽기 전용 캐시 구현체 — 쓰기 메서드를 강제로 구현해야 함
class ReadOnlyCacheRepository : DataRepository {
    override fun findById(id: Long) = cache[id]
    override fun findAll() = cache.values.toList()
    override fun count() = cache.size.toLong()
    override fun existsById(id: Long) = cache.containsKey(id)
    override fun findByPage(page: Int, size: Int) = cache.values.drop(page * size).take(size)
    override fun search(query: String) = cache.values.filter { it.toString().contains(query) }

    // 사용하지 않지만 강제로 구현
    override fun save(entity: Any) = throw UnsupportedOperationException("읽기 전용")
    override fun update(entity: Any) = throw UnsupportedOperationException("읽기 전용")
    override fun delete(id: Long) = throw UnsupportedOperationException("읽기 전용")
    override fun exportToCsv() = throw UnsupportedOperationException("미지원")
    override fun bulkInsert(entities: List<Any>) = throw UnsupportedOperationException("읽기 전용")
    override fun truncate() = throw UnsupportedOperationException("읽기 전용")
}
```

---

## 개선 — 역할에 따라 인터페이스 분리

```kotlin
// 역할별 분리
interface ReadRepository<T, ID> {
    fun findById(id: ID): T?
    fun findAll(): List<T>
    fun existsById(id: ID): Boolean
    fun count(): Long
}

interface WriteRepository<T, ID> {
    fun save(entity: T): T
    fun update(entity: T): T
    fun delete(id: ID)
}

interface PageableRepository<T> {
    fun findByPage(page: Int, size: Int): List<T>
}

interface SearchRepository<T> {
    fun search(query: String): List<T>
}

interface BulkRepository<T> {
    fun bulkInsert(entities: List<T>)
}

interface ExportRepository {
    fun exportToCsv(): ByteArray
}
```

### 구현체는 필요한 인터페이스만 선택

```kotlin
// 읽기 전용 캐시 — 불필요한 메서드 없음
class ReadOnlyCacheRepository<T>(
    private val cache: Map<Long, T>
) : ReadRepository<T, Long>, PageableRepository<T> {
    override fun findById(id: Long) = cache[id]
    override fun findAll() = cache.values.toList()
    override fun existsById(id: Long) = cache.containsKey(id)
    override fun count() = cache.size.toLong()
    override fun findByPage(page: Int, size: Int) =
        cache.values.drop(page * size).take(size)
}

// 전체 기능 JPA 구현체
@Repository
class UserJpaRepository(
    private val jpa: UserJpaInterface
) : ReadRepository<User, Long>,
    WriteRepository<User, Long>,
    PageableRepository<User>,
    SearchRepository<User> {

    override fun findById(id: Long) = jpa.findById(id).orElse(null)
    override fun findAll() = jpa.findAll()
    override fun existsById(id: Long) = jpa.existsById(id)
    override fun count() = jpa.count()
    override fun save(entity: User) = jpa.save(entity)
    override fun update(entity: User) = jpa.save(entity)
    override fun delete(id: Long) = jpa.deleteById(id)
    override fun findByPage(page: Int, size: Int) =
        jpa.findAll(PageRequest.of(page, size)).content
    override fun search(query: String) = jpa.findByNameContaining(query)
}
```

---

## 실전 예제 — 알림 채널

```kotlin
// ISP 위반: 모든 채널이 모든 기능을 구현해야 함
interface Notifier {
    fun sendText(to: String, message: String)
    fun sendHtml(to: String, html: String)       // SMS는 HTML 불가
    fun sendWithAttachment(to: String, file: ByteArray)  // SMS는 첨부 불가
    fun sendBulk(recipients: List<String>, message: String)
    fun scheduleMessage(to: String, message: String, at: Instant)
}

// ✅ ISP 준수: 기능별 분리
interface TextMessageSender {
    fun send(to: String, message: String)
}

interface HtmlEmailSender {
    fun sendHtml(to: String, html: String)
    fun sendWithAttachment(to: String, html: String, files: List<ByteArray>)
}

interface BulkSender {
    fun sendBulk(recipients: List<String>, message: String)
}

interface ScheduledSender {
    fun schedule(to: String, message: String, at: Instant)
}

// SMS — 텍스트만
class SmsSender(private val smsGateway: SmsGateway) : TextMessageSender {
    override fun send(to: String, message: String) {
        smsGateway.sendSms(to, message)
    }
}

// 이메일 — 모든 기능
class EmailSender(
    private val mailClient: MailClient
) : TextMessageSender, HtmlEmailSender, BulkSender, ScheduledSender {

    override fun send(to: String, message: String) = mailClient.sendPlain(to, message)
    override fun sendHtml(to: String, html: String) = mailClient.sendHtml(to, html)
    override fun sendWithAttachment(to: String, html: String, files: List<ByteArray>) {
        mailClient.sendWithAttachments(to, html, files)
    }
    override fun sendBulk(recipients: List<String>, message: String) {
        recipients.forEach { send(it, message) }
    }
    override fun schedule(to: String, message: String, at: Instant) {
        mailClient.schedule(to, message, at)
    }
}

// 사용하는 쪽은 필요한 인터페이스만 의존
@Service
class OrderNotificationService(
    private val textSender: TextMessageSender,   // SMS or Email 모두 가능
) {
    fun notifyOrderCreated(userId: String, orderId: Long) {
        textSender.send(userId, "주문 #$orderId 이 접수되었습니다")
    }
}

@Service
class MarketingService(
    private val bulkSender: BulkSender,          // 대량 발송 기능만 의존
) {
    fun sendCampaign(userIds: List<String>, message: String) {
        bulkSender.sendBulk(userIds, message)
    }
}
```

---

## Kotlin에서 ISP 구현 패턴

### 인터페이스 기본 구현 활용

```kotlin
interface Auditable {
    fun createdAt(): Instant = Instant.now()  // 기본 구현 제공
    fun updatedAt(): Instant = Instant.now()
    fun createdBy(): String = "system"
}

interface Softdeletable {
    var deletedAt: Instant?
    fun isDeleted(): Boolean = deletedAt != null
    fun softDelete() { deletedAt = Instant.now() }
}

// 필요한 것만 조합
@Entity
class Article : Auditable, Softdeletable {
    // Auditable 기본 구현 사용, Softdeletable만 직접 구현
    override var deletedAt: Instant? = null
}
```

### 역할 인터페이스 (Role Interface)

```kotlin
// 사용자 도메인의 역할별 인터페이스
interface Authenticatable {
    val email: String
    val passwordHash: String
    fun hasRole(role: Role): Boolean
}

interface Profileable {
    val name: String
    val avatarUrl: String?
    val bio: String?
}

interface Subscribable {
    val subscriptionTier: SubscriptionTier
    fun isSubscribed(): Boolean
    fun canAccess(feature: Feature): Boolean
}

// 전체 User는 모든 역할을 구현
class User : Authenticatable, Profileable, Subscribable {
    override val email: String = ""
    // ...
}

// 각 서비스는 필요한 역할 인터페이스만 의존
class AuthService(private val users: Map<String, Authenticatable>)
class ProfileService(private val user: Profileable)
class FeatureGateService(private val user: Subscribable)
```

---

## 테스트 관점

ISP를 지키면 Mock이 간결해진다.

```kotlin
// ISP 위반 시 테스트 — 불필요한 Mock 많음
class OrderNotificationServiceTest {
    // God Interface Mock — 사용 안 하는 메서드도 전부 Mock
    val notifier = mockk<Notifier> {
        every { sendText(any(), any()) } returns Unit
        every { sendHtml(any(), any()) } returns Unit       // 테스트에 불필요
        every { sendWithAttachment(any(), any()) } returns Unit  // 테스트에 불필요
        every { sendBulk(any(), any()) } returns Unit       // 테스트에 불필요
        // ...
    }
}

// ISP 준수 시 테스트 — 필요한 것만 Mock
class OrderNotificationServiceTest {
    val textSender = mockk<TextMessageSender> {
        every { send(any(), any()) } returns Unit
    }
    val service = OrderNotificationService(textSender)

    @Test
    fun `주문 생성 시 문자 발송`() {
        service.notifyOrderCreated("user-001", 12345L)

        verify { textSender.send("user-001", match { it.contains("12345") }) }
    }
}
```

---

## 정리

| | ISP 위반 | ISP 준수 |
|---|----------|----------|
| 인터페이스 크기 | 크고 범용적 | 작고 집중됨 |
| 구현 부담 | 불필요한 메서드 구현 필요 | 필요한 것만 구현 |
| 변경 영향 | 인터페이스 변경 시 전체 구현체 영향 | 해당 역할 구현체만 영향 |
| 테스트 Mock | 불필요한 Mock 설정 많음 | 필요한 메서드만 Mock |
| 의존성 | 사용하지 않는 것에 의존 | 사용하는 것에만 의존 |

**실천 팁:**
- 인터페이스 메서드가 5개를 넘으면 분리를 고려한다
- `UnsupportedOperationException`이 있다면 ISP 위반 신호
- Mock 설정이 복잡하다면 인터페이스를 좁힌다
- Kotlin의 인터페이스 기본 구현으로 선택적 기능을 제공한다
