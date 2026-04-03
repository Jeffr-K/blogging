---
title: "[TDD 시리즈] 20. Outside-In TDD — 바깥에서 안으로 설계하기"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "Outside-In", "더블루프TDD", "인수테스트", "설계", "London School"]
---

# Outside-In TDD — 바깥에서 안으로 설계하기

TDD를 처음 배우면 도메인 객체부터 만든다. `User` 클래스 → `UserRepository` 인터페이스 → `UserService` → `UserController` 순으로 쌓아 올라간다. 안에서 바깥으로. 이것이 Inside-Out TDD다. 그런데 이 방식에는 조용한 함정이 있다. API를 만든 뒤에야 "사용하기 불편하다"는 걸 알게 된다. Outside-In TDD는 반대로 간다.

## Inside-Out의 함정

Inside-Out 방식은 직관적이다. 기반부터 탄탄히 쌓는 느낌이 든다. 문제는 기반을 쌓는 동안 "위에서 어떻게 쓰일지"를 추측한다는 점이다.

```typescript
// Inside-Out: 먼저 User 도메인 객체를 만들었다
class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly createdAt: Date,
  ) {}
}

// 그 다음 Repository를 만들었다
interface UserRepository {
  save(user: User): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}

// 그 다음 Service를 만들었다
class UserService {
  async register(email: string, password: string): Promise<User> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) throw new Error('이미 등록된 이메일입니다');
    const user = new User(uuid(), email, hash(password), new Date());
    await this.userRepo.save(user);
    return user; // <-- Controller에서는 id만 필요한데 User 전체를 반환
  }
}

// Controller를 만들고 나서야 발견: 응답에 passwordHash가 노출됨
// Service 인터페이스가 Controller의 실제 필요와 미묘하게 어긋남
```

Inside-Out은 실제 사용 시점에 설계 문제를 발견한다. Outside-In은 사용 시점에서 시작하므로 처음부터 사용자 관점의 설계가 나온다.

## Outside-In TDD: 더블 루프

Outside-In TDD의 핵심은 두 개의 중첩된 피드백 루프다.

```
┌─────────────────────────────────────────────────────┐
│ 바깥 루프 (인수 테스트 / E2E 테스트)                  │
│                                                     │
│  ❶ 인수 테스트 작성 (실패)                            │
│         │                                           │
│         ▼                                           │
│  ┌─────────────────────────────────────────┐        │
│  │ 안쪽 루프 (단위 테스트)                   │        │
│  │                                         │        │
│  │  ❷ 단위 테스트 작성 (실패)               │        │
│  │  ❸ 최소 구현 (Green)                    │        │
│  │  ❹ 리팩토링                             │        │
│  │  (❷~❹ 반복)                            │        │
│  └─────────────────────────────────────────┘        │
│         │                                           │
│         ▼                                           │
│  ❺ 인수 테스트 통과                                  │
└─────────────────────────────────────────────────────┘
```

바깥 루프는 느리게 돈다(기능 단위). 안쪽 루프는 빠르게 돈다(메서드 단위). 바깥 루프가 통과할 때까지 안쪽 루프를 반복한다.

## 실전 예시: 사용자 등록 API

Outside-In으로 사용자 등록 API를 개발하는 과정을 따라가 보자.

**❶단계: 인수 테스트 작성 (바깥 루프 시작)**

```typescript
// tests/acceptance/user-registration.test.ts
describe('사용자 등록 API', () => {
  it('유효한 이메일과 비밀번호로 등록하면 201과 사용자 ID를 반환한다', async () => {
    const response = await request(app)
      .post('/api/users/register')
      .send({ email: 'new@example.com', password: 'P@ssw0rd123' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
    });
    // passwordHash는 응답에 포함되지 않아야 한다
    expect(response.body.passwordHash).toBeUndefined();
  });

  it('이미 등록된 이메일로 등록하면 409를 반환한다', async () => {
    await request(app)
      .post('/api/users/register')
      .send({ email: 'existing@example.com', password: 'P@ssw0rd123' });

    const response = await request(app)
      .post('/api/users/register')
      .send({ email: 'existing@example.com', password: 'AnotherPass1' });

    expect(response.status).toBe(409);
  });
});
```

이 테스트를 작성하는 순간 "Controller가 어떤 인터페이스를 가져야 하는가"가 확정된다. `POST /api/users/register`, 요청 바디, 응답 형태. Outside-In은 API 설계를 명세에서 시작한다.

**❷단계: Controller 단위 테스트 (안쪽 루프)**

인수 테스트가 실패한다. 이제 안쪽 루프를 시작한다. Controller가 필요하다. Controller를 TDD로 만든다.

```typescript
// tests/unit/UserController.test.ts
describe('UserController.register', () => {
  let controller: UserController;
  let mockRegisterUseCase: { execute: jest.Mock };

  beforeEach(() => {
    mockRegisterUseCase = { execute: jest.fn() };
    controller = new UserController(mockRegisterUseCase);
  });

  it('유스케이스를 호출하고 id를 201로 반환한다', async () => {
    mockRegisterUseCase.execute.mockResolvedValue({ id: 'user-123' });

    const req = { body: { email: 'test@example.com', password: 'P@ssw0rd' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.register(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'user-123' });
  });

  it('이메일 중복 시 409를 반환한다', async () => {
    mockRegisterUseCase.execute.mockRejectedValue(new DuplicateEmailError());

    const req = { body: { email: 'dup@example.com', password: 'P@ssw0rd' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await controller.register(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});
```

Controller 테스트에서 `RegisterUserUseCase` 인터페이스가 자연스럽게 등장했다. Outside-In은 협력자(collaborator)가 필요할 때 인터페이스를 먼저 정의하고 Stub으로 교체한다.

**❸단계: UseCase 단위 테스트**

Controller가 녹색이 되면, 다음 레이어인 UseCase로 내려간다.

```typescript
// tests/unit/RegisterUserUseCase.test.ts
describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let userRepo: InMemoryUserRepository;
  let emailSender: FakeEmailSender;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    emailSender = new FakeEmailSender();
    useCase = new RegisterUserUseCase(userRepo, emailSender);
  });

  it('사용자를 저장하고 환영 이메일을 발송한다', async () => {
    const result = await useCase.execute({
      email: 'new@example.com',
      password: 'P@ssw0rd123',
    });

    expect(result.id).toBeDefined();
    const saved = await userRepo.findByEmail('new@example.com');
    expect(saved).not.toBeNull();
    expect(emailSender.sentEmails).toHaveLength(1);
    expect(emailSender.sentEmails[0].to).toBe('new@example.com');
  });

  it('중복 이메일이면 DuplicateEmailError를 던진다', async () => {
    await useCase.execute({ email: 'dup@example.com', password: 'P@ss1' });

    await expect(
      useCase.execute({ email: 'dup@example.com', password: 'P@ss2' })
    ).rejects.toThrow(DuplicateEmailError);
  });
});
```

`InMemoryUserRepository`와 `FakeEmailSender`는 실제 DB와 SMTP 없이 UseCase를 빠르게 테스트한다. Outside-In TDD는 자연스럽게 이런 Fake 객체들을 만들게 된다.

## Outside-In의 장단점

**장점**이 있다. 사용자 관점을 잃지 않는다. 인수 테스트가 항상 "이 기능이 완성되면 어떤 모습인가"를 상기시킨다. 설계가 실제 필요에서 출발한다. 인터페이스가 사용 시점에서 만들어지므로 불필요한 메서드가 생기지 않는다.

**단점**도 있다. 초기 셋업 비용이 높다. 인수 테스트 레벨의 인프라(HTTP 서버, 인메모리 DB)를 먼저 준비해야 한다. Stub과 Fake가 많아진다. 매 레이어 경계마다 인터페이스와 가짜 구현체가 생긴다. 잘못 관리하면 테스트 유지보수 비용이 올라간다.

## Inside-Out이 적합한 경우

모든 상황에서 Outside-In이 우월한 건 아니다. Inside-Out이 더 자연스러운 경우가 있다.

알고리즘이나 계산 로직을 구현할 때는 Inside-Out이 낫다. 소수 판별, 경로 탐색, 날짜 계산 같은 것들. 입출력이 명확하고 외부 의존성이 없다. 굳이 인수 테스트부터 시작할 이유가 없다.

도메인이 완전히 명확할 때도 Inside-Out이 빠르다. 도메인 전문가이고 모델이 머릿속에 이미 있다면, 도메인 객체부터 만들고 올라오는 게 빠르다. Outside-In의 가치는 "무엇이 필요한가"가 불명확할 때 극대화된다.

실무에서는 두 방식을 섞는다. 새로운 기능의 진입점(API, 이벤트 핸들러)은 Outside-In으로 시작하고, 그 안의 순수한 도메인 로직은 Inside-Out으로 만든다.
