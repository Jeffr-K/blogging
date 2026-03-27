---
title: "Spring Boot: Spring MVC 완전 가이드"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "spring-mvc", "rest", "controller"]
---

# Spring MVC 완전 가이드

## DispatcherServlet 처리 흐름

```
클라이언트 HTTP 요청
        ↓
  DispatcherServlet
        ↓
  HandlerMapping  ──── 어느 컨트롤러 메서드가 처리할지 결정
        ↓
  HandlerAdapter  ──── 컨트롤러 메서드 실행 (파라미터 바인딩 포함)
        ↓
  Controller 메서드 실행
        ↓
  MessageConverter ─── 반환값을 JSON 등으로 직렬화
        ↓
  HTTP 응답
```

### Filter vs HandlerInterceptor

| 항목 | Filter | HandlerInterceptor |
|---|---|---|
| 레벨 | 서블릿 컨테이너 | Spring MVC |
| 적용 범위 | 모든 요청 | Spring MVC 요청만 |
| Spring 빈 접근 | 어려움 | 쉬움 |
| 사용 사례 | 인코딩, 보안 필터 | 로깅, 인증 체크 |

```java
@Component
public class LoggingInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) {
        request.setAttribute("startTime", System.currentTimeMillis());
        return true; // false 반환 시 요청 중단
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        long startTime = (Long) request.getAttribute("startTime");
        log.info("Request: {} {} - {}ms",
            request.getMethod(), request.getRequestURI(),
            System.currentTimeMillis() - startTime);
    }
}
```

---

## 컨트롤러

### 기본 매핑

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<UserResponse> getUsers(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return userService.findAll(page, size);
    }

    @GetMapping("/{id}")
    public UserResponse getUser(@PathVariable Long id) {
        return userService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse createUser(@RequestBody @Valid CreateUserRequest request) {
        return userService.create(request);
    }

    @PutMapping("/{id}")
    public UserResponse updateUser(
        @PathVariable Long id,
        @RequestBody @Valid UpdateUserRequest request
    ) {
        return userService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable Long id) {
        userService.delete(id);
    }
}
```

### 파라미터 종류

```java
@GetMapping("/search")
public List<UserResponse> search(
    @PathVariable Long teamId,              // /teams/{teamId}/members
    @RequestParam String keyword,           // ?keyword=john
    @RequestParam(required = false) String status,  // 선택적 파라미터
    @RequestParam(defaultValue = "0") int page,     // 기본값
    @RequestHeader("X-Request-Id") String requestId, // 헤더
    @CookieValue(name = "session") String session    // 쿠키
) { ... }
```

---

## 요청 데이터 바인딩 & 검증

### @Valid 검증

```java
public record CreateUserRequest(
    @NotBlank(message = "이름은 필수입니다")
    String name,

    @Email(message = "이메일 형식이 아닙니다")
    @NotBlank
    String email,

    @Min(value = 1, message = "나이는 1 이상이어야 합니다")
    @Max(value = 150)
    int age,

    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{8,}$",
             message = "비밀번호는 영문+숫자 8자 이상이어야 합니다")
    String password
) {}
```

검증 실패 시 `MethodArgumentNotValidException`이 발생한다.

### 전역 예외 처리 (@RestControllerAdvice)

```java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // 입력 검증 실패
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail handleValidationException(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, "입력값이 올바르지 않습니다"
        );
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
            .forEach(e -> errors.put(e.getField(), e.getDefaultMessage()));
        problem.setProperty("errors", errors);
        return problem;
    }

    // 리소스 없음
    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    // 비즈니스 규칙 위반
    @ExceptionHandler(BusinessException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ProblemDetail handleBusiness(BusinessException ex) {
        return ProblemDetail.forStatusAndDetail(
            HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage()
        );
    }

    // 예상치 못한 오류
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ProblemDetail handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);
        return ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다"
        );
    }
}
```

### ProblemDetail (RFC 7807, Spring 6+)

표준화된 에러 응답 형식:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "입력값이 올바르지 않습니다",
  "instance": "/api/v1/users",
  "errors": {
    "name": "이름은 필수입니다",
    "email": "이메일 형식이 아닙니다"
  }
}
```

---

## 응답 처리

### ResponseEntity

```java
@GetMapping("/{id}")
public ResponseEntity<UserResponse> getUser(@PathVariable Long id) {
    UserResponse user = userService.findById(id);
    return ResponseEntity.ok()
        .header("X-User-Version", "1")
        .body(user);
}

@PostMapping
public ResponseEntity<UserResponse> createUser(@RequestBody @Valid CreateUserRequest req) {
    UserResponse created = userService.create(req);
    URI location = URI.create("/api/v1/users/" + created.id());
    return ResponseEntity.created(location).body(created);
}
```

### Jackson ObjectMapper 커스터마이징

```java
@Bean
public Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
    return builder -> builder
        .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .featuresToEnable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .modules(new JavaTimeModule())
        .serializationInclusion(JsonInclude.Include.NON_NULL);
}
```

---

## 파일 업로드 & 다운로드

### 업로드

```java
@PostMapping("/upload")
public UploadResponse uploadFile(@RequestParam MultipartFile file) {
    if (file.isEmpty()) {
        throw new BusinessException("파일이 비어있습니다");
    }
    String savedPath = fileStorageService.save(file);
    return new UploadResponse(savedPath, file.getOriginalFilename(), file.getSize());
}
```

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
```

### 대용량 파일 스트리밍 다운로드

```java
@GetMapping("/download/{fileId}")
public ResponseEntity<StreamingResponseBody> downloadFile(@PathVariable Long fileId) {
    FileInfo fileInfo = fileService.findById(fileId);

    StreamingResponseBody body = outputStream -> {
        try (InputStream inputStream = fileService.getInputStream(fileInfo)) {
            inputStream.transferTo(outputStream);
        }
    };

    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"" + fileInfo.getOriginalName() + "\"")
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .body(body);
}
```

`StreamingResponseBody`를 사용하면 전체 파일을 메모리에 올리지 않고 스트리밍으로 전송한다.

---

## Async 요청 처리

### DeferredResult

외부 이벤트가 완료될 때까지 응답을 보류한다.

```java
@GetMapping("/notifications")
public DeferredResult<List<Notification>> getNotifications(@RequestParam Long userId) {
    DeferredResult<List<Notification>> result = new DeferredResult<>(30_000L); // 30초 타임아웃
    result.onTimeout(() -> result.setErrorResult(
        ResponseEntity.status(HttpStatus.REQUEST_TIMEOUT).build()
    ));

    notificationService.registerCallback(userId, notifications -> {
        result.setResult(notifications);
    });

    return result;
}
```

### Callable

별도 스레드에서 처리한다.

```java
@GetMapping("/heavy-task")
public Callable<HeavyResult> performHeavyTask() {
    return () -> {
        // 별도 스레드에서 실행 (서블릿 스레드를 점유하지 않음)
        return heavyTaskService.execute();
    };
}
```

> **주의**: `@Async`와 웹 레이어를 조합할 때 `SecurityContext` 전파를 신경써야 한다. Spring Security는 기본적으로 `ThreadLocal`에 컨텍스트를 저장하기 때문에 다른 스레드로 넘어가면 인증 정보가 사라진다. `DelegatingSecurityContextCallable`이나 `SecurityContextHolder.MODE_INHERITABLETHREADLOCAL` 설정이 필요할 수 있다.
