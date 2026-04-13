# SRP — 단일 책임 원칙 (Single Responsibility Principle)

> "클래스는 변경되어야 할 이유가 단 하나여야 한다."
> — Robert C. Martin

---

## 핵심 개념

SRP의 핵심은 "책임 = 변경 이유"다.
한 클래스가 여러 이유로 변경된다면 여러 책임을 가진 것이다.

```
SRP 위반 신호:
- 클래스 이름에 "And", "Manager", "Handler", "Util"이 붙는다
- 메서드 수가 15개를 넘는다
- 테스트 케이스가 비관련 도메인에 걸쳐 퍼진다
- 변경 한 곳이 예상치 못한 다른 곳을 깨뜨린다
```

---

## 위반 예제 — UserService가 너무 많은 일을 한다

```kotlin
// 나쁜 예: UserService가 4가지 책임을 가짐
class UserService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val emailSender: JavaMailSender,
    private val jwtUtil: JwtUtil,
) {
    // 책임 1: 비즈니스 로직
    fun register(request: RegisterRequest): User {
        if (userRepository.existsByEmail(request.email)) {
            throw DuplicateEmailException(request.email)
        }
        val encoded = passwordEncoder.encode(request.password)  // 책임 2: 암호화
        val user = User(email = request.email, password = encoded)
        val saved = userRepository.save(user)

        // 책임 3: 이메일 전송
        val message = SimpleMailMessage()
        message.setTo(request.email)
        message.subject = "회원가입 완료"
        message.text = "안녕하세요, ${request.email}님"
        emailSender.send(message)

        return saved
    }

    // 책임 4: 인증
    fun login(email: String, password: String): String {
        val user = userRepository.findByEmail(email)
            ?: throw UnauthorizedException("이메일 또는 비밀번호가 틀립니다")
        if (!passwordEncoder.matches(password, user.password)) {
            throw UnauthorizedException("이메일 또는 비밀번호가 틀립니다")
        }
        return jwtUtil.generateToken(user.id.toString())
    }
}
```

**변경 이유:**
1. 회원가입 정책이 바뀌면 (비즈니스)
2. 비밀번호 암호화 알고리즘이 바뀌면 (보안)
3. 이메일 템플릿이 바뀌면 (UX)
4. JWT 만료시간 정책이 바뀌면 (인증)

→ 4가지 이유로 이 클래스가 수정된다 = SRP 위반

---

## 개선 — 책임 분리

### 1. 이메일 발송 책임 분리

```kotlin
@Component
class UserEmailSender(private val mailSender: JavaMailSender) {

    fun sendWelcome(email: String) {
        val message = SimpleMailMessage().apply {
            setTo(email)
            subject = "회원가입 완료"
            text = "안녕하세요, ${email}님. 가입을 환영합니다."
        }
        mailSender.send(message)
    }

    fun sendPasswordReset(email: String, token: String) {
        val message = SimpleMailMessage().apply {
            setTo(email)
            subject = "비밀번호 재설정"
            text = "재설정 링크: https://example.com/reset?token=$token"
        }
        mailSender.send(message)
    }
}
```

### 2. 인증 책임 분리

```kotlin
@Component
class AuthService(
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val jwtUtil: JwtUtil,
) {
    fun login(email: String, password: String): String {
        val user = userRepository.findByEmail(email)
            ?: throw UnauthorizedException("이메일 또는 비밀번호가 틀립니다")

        if (!passwordEncoder.matches(password, user.password)) {
            throw UnauthorizedException("이메일 또는 비밀번호가 틀립니다")
        }

        return jwtUtil.generateToken(user.id.toString())
    }
}
```

### 3. 비밀번호 정책 책임 분리

```kotlin
@Component
class PasswordPolicyService(private val passwordEncoder: PasswordEncoder) {

    fun encode(rawPassword: String): String {
        validate(rawPassword)
        return passwordEncoder.encode(rawPassword)
    }

    fun matches(rawPassword: String, encodedPassword: String): Boolean =
        passwordEncoder.matches(rawPassword, encodedPassword)

    private fun validate(password: String) {
        require(password.length >= 8) { "비밀번호는 8자 이상이어야 합니다" }
        require(password.any { it.isDigit() }) { "숫자를 포함해야 합니다" }
        require(password.any { it.isLetter() }) { "문자를 포함해야 합니다" }
    }
}
```

### 4. 정리된 UserService

```kotlin
// 이제 UserService는 "사용자 도메인 비즈니스 로직"만 담당
@Service
class UserService(
    private val userRepository: UserRepository,
    private val passwordPolicyService: PasswordPolicyService,
    private val userEmailSender: UserEmailSender,
) {
    @Transactional
    fun register(request: RegisterRequest): User {
        if (userRepository.existsByEmail(request.email)) {
            throw DuplicateEmailException(request.email)
        }

        val user = User(
            email = request.email,
            password = passwordPolicyService.encode(request.password)
        )
        val saved = userRepository.save(user)

        userEmailSender.sendWelcome(request.email)

        return saved
    }
}
```

---

## 레이어 관점에서 본 SRP

```
Controller  — HTTP 요청/응답 변환만 담당
    ↓
Service     — 비즈니스 유스케이스 오케스트레이션만 담당
    ↓
Domain      — 도메인 규칙만 담당 (Entity, Value Object)
    ↓
Repository  — 영속성만 담당
```

### Controller가 SRP를 지키는 방법

```kotlin
@RestController
@RequestMapping("/api/users")
class UserController(
    private val userService: UserService,
    private val authService: AuthService,
) {
    // Controller는 요청 파싱 + 응답 매핑만
    @PostMapping("/register")
    fun register(@Valid @RequestBody request: RegisterRequest): ResponseEntity<UserResponse> {
        val user = userService.register(request)
        return ResponseEntity.status(201).body(user.toResponse())
    }

    // 비즈니스 로직은 Service에게 위임
    @PostMapping("/login")
    fun login(@RequestBody request: LoginRequest): ResponseEntity<TokenResponse> {
        val token = authService.login(request.email, request.password)
        return ResponseEntity.ok(TokenResponse(token))
    }
}

// 매핑은 확장 함수로 분리
private fun User.toResponse() = UserResponse(
    id = this.id!!,
    email = this.email,
    createdAt = this.createdAt,
)
```

---

## Domain Entity에서의 SRP

### 위반: Entity가 비즈니스 로직 + 포맷팅 + 검증을 모두 담당

```kotlin
// 나쁜 예
@Entity
class Order {
    // ...

    // 비즈니스 로직
    fun confirm() { this.status = CONFIRMED }

    // 포맷팅 — 다른 책임
    fun toReceiptHtml(): String = "<html>...</html>"
    fun toCsvLine(): String = "$id,$amount,$status"

    // 외부 시스템 연동 — 다른 책임
    fun sendToErp(erpClient: ErpClient) { erpClient.sync(this) }
}
```

```kotlin
// 좋은 예: Entity는 도메인 규칙만
@Entity
class Order(
    val id: Long = 0,
    var status: OrderStatus = PENDING,
    val amount: Money,
) {
    fun confirm() {
        check(status == PENDING) { "대기 상태의 주문만 확정할 수 있습니다" }
        this.status = CONFIRMED
    }

    fun cancel() {
        check(status != DELIVERED) { "배송 완료된 주문은 취소할 수 없습니다" }
        this.status = CANCELLED
    }
}

// 포맷팅은 별도 클래스로
class OrderReceiptFormatter {
    fun toHtml(order: Order): String = "<html>...</html>"
    fun toCsv(order: Order): String = "${order.id},${order.amount},${order.status}"
}
```

---

## 테스트 관점

SRP를 지키면 테스트가 작고 명확해진다.

```kotlin
// 이메일 발송 테스트 — UserService와 완전히 독립
class UserEmailSenderTest {
    private val mailSender = mockk<JavaMailSender>(relaxed = true)
    private val sender = UserEmailSender(mailSender)

    @Test
    fun `환영 이메일 전송`() {
        sender.sendWelcome("user@example.com")

        verify {
            mailSender.send(match<SimpleMailMessage> {
                it.to?.contains("user@example.com") == true &&
                it.subject == "회원가입 완료"
            })
        }
    }
}

// 비밀번호 정책 테스트 — 암호화 로직만 집중
class PasswordPolicyServiceTest {
    private val encoder = BCryptPasswordEncoder()
    private val policy = PasswordPolicyService(encoder)

    @Test
    fun `8자 미만 비밀번호 거부`() {
        shouldThrow<IllegalArgumentException> {
            policy.encode("short1")
        }
    }

    @Test
    fun `숫자 없는 비밀번호 거부`() {
        shouldThrow<IllegalArgumentException> {
            policy.encode("onlyletters")
        }
    }
}
```

---

## 정리

| | SRP 위반 | SRP 준수 |
|---|----------|----------|
| 클래스 크기 | 커짐 | 작고 집중됨 |
| 변경 영향 범위 | 넓음 | 국소화됨 |
| 테스트 | 복잡함 | 단순하고 명확함 |
| 재사용 | 어려움 | 쉬움 |
| 이름 짓기 | 모호함 | 명확함 |

**실천 팁:**
- 클래스 설명에 "그리고(and)"가 필요하다면 분리를 고려한다
- 메서드가 10개를 넘으면 역할을 다시 정의한다
- 테스트가 어렵게 느껴지면 SRP를 점검한다
