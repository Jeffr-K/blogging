---
title: "NestJS: 개요와 핵심 철학"
author: jeffrey
date: 2026-04-06
tags: ["nest-js", "node-js", "architecture", "typescript"]
---

## Node.js 백엔드 개발의 "구조적 결핍"

Node.js는 빠르고 유연하며, 거대한 생태계를 가진 훌륭한 플랫폼이다. 하지만 엔터프라이즈급 대규모 애플리케이션을 구축할 때, 많은 개발자들은 동일한 벽에 부딪히곤 했다. 바로 **"정해진 구조가 없다"**는 점이다.

가장 대중적인 웹 프레임워크인 **Express**를 사용해본 개발자라면 다음과 같은 고통을 경험했을 것이다.

### 1. 개발자마다 제각각인 프로젝트 구조

Express는 "Opinionated"하지 않다. 즉, 폴더 구조를 어떻게 짜든, 라우터를 어디에 두든 프레임워크는 상관하지 않는다. 이는 초기 학습 곡선을 낮춰주지만, 협업 시에는 오히려 독이 된다.

- "우리는 `routes/` 폴더를 쓰는데, 옆 팀은 `controllers/` 폴더를 쓰네?"
- "비즈니스 로직은 어디에 둬야 하지? 라우터 핸들러 안? 아니면 별도 서비스 파일?"
- 프로젝트가 커질수록 코드는 스파게티처럼 얽히고, 유지보수는 지옥이 된다.

### 2. 의존성 관리의 어려움

순수 Node.js 환경에서는 객체 간의 의존성을 수동으로 관리해야 한다. 한 서비스가 다른 서비스를 필요로 할 때 직접 인스턴스를 생성하거나 주입하는 코드를 일일이 작성해야 하며, 이는 결합도를 높이고 테스트를 어렵게 만든다.

### 3. TypeScript 도입의 번거로움

`Express` 는 기본적으로 `JavaScript` 기반이다. `TypeScript` 를 도입하려면 컴파일 설정부터 타입 정의 라이브러리(`@types/express`) 설치까지 모든 것을 수동으로 세팅해야 하며, 여전히 프레임워크 레벨에서의 강력한 타입 지원은 부족하다.

---

## NestJS가 해결한 "아키텍처의 부재"

NestJS는 이러한 혼란을 종식시키기 위해 등장했다. NestJS의 핵심 목표는 **"개발자와 팀이 고도로 테스트 가능하고, 확장 가능하며, 유지관리가 쉬운 애플리케이션을 만들 수 있는 아키텍처를 제공하는 것"**이다.

### 1. Angular에서 영감을 받은 강력한 모듈 시스템

NestJS는 Angular의 아키텍처를 서버 사이드로 가져왔다. 애플리케이션을 독립적인 **모듈(Module)** 단위로 쪼개고, 각 모듈이 자신의 **컨트롤러(Controller)**와 **프로바이더(Provider)**를 관리하게 함으로써 코드의 응집도를 높이고 결합도를 낮췄다.

### 2. 의존성 주입(DI) 컨테이너 내장

개발자가 직접 인스턴스를 관리할 필요가 없다. 컨테이너가 객체의 생명주기를 관리하며 필요한 곳에 주입해준다.

```typescript
@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {} // 자동 주입
}
```

### 3. TypeScript-First 프레임워크

NestJS는 처음부터 TypeScript로 구축되었으며, TypeScript의 기능을 최대한 활용하도록 설계되었다. 데코레이터(Decorator), 인터페이스(Interface), 클래스(Class)를 활용해 선언적이고 명확한 코드를 작성할 수 있다.

---

## NestJS vs Express 직접 사용 비교

| 항목 | Express | NestJS |
|------|---------|--------|
| **철학** | Minimalist, Unopinionated | Full-featured, Opinionated |
| **구조** | 개발자 마음대로 (자유도 높음) | 정해진 아키텍처 (일관성 높음) |
| **의존성 주입** | 수동 관리 또는 외부 라이브러리 | 내장 IoC 컨테이너 제공 |
| **언어 지원** | JavaScript 중심 (TS는 추가 설정 필요) | TypeScript 기본 (강력한 타입 지원) |
| **학습 곡선** | 매우 낮음 | 중간 (OOP, DI 개념 필요) |
| **생산성** | 초기엔 빠르나 유지보수 시 하락 | 초기 설정은 있으나 장기적 생산성 높음 |
| **기능 확장** | 미들웨어 기반 | 인터셉터, 가드, 파이프 등 정교한 도구 제공 |

> **중요**: NestJS는 Express를 대체하는 것이 아니라, Express(또는 Fastify) 위에서 동작하는 **추상화 레이어**다. 필요하다면 여전히 하부 프레임워크의 API에 직접 접근할 수도 있다.

---

## "Convention over Configuration"과 OOP

NestJS는 **"관례(Convention)"**를 중시한다. 일관된 코딩 스타일과 폴더 구조를 유지하도록 유도함으로써, 어떤 NestJS 프로젝트를 열어보더라도 금방 구조를 파악할 수 있게 한다.

또한 객체지향 설계 원칙(SOLID)을 따르기 매우 쉬운 구조를 갖추고 있어, 엔터프라이즈 환경에서 강력한 힘을 발휘한다.

### 핵심 구성 요소 3총사

1. **Module**: 애플리케이션을 구성하는 밀접하게 관련된 기능의 집합체. 모든 애플리케이션은 적어도 하나의 루트 모듈을 가진다.
2. **Controller**: 들어오는 요청(Request)을 받고 응답(Response)을 클라이언트에게 돌려주는 역할을 담당한다.
3. **Provider (Service)**: 실제 비즈니스 로직을 수행하며 다른 클래스에 주입될 수 있는 대상을 의미한다.

---

## 첫 NestJS 프로젝트의 느낌

Nest CLI를 이용해 프로젝트를 생성하면 다음과 같은 보일러플레이트가 만들어진다.

```bash
# Nest 프로젝트 생성
nest new project-name
```

```typescript
// app.module.ts
@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

// app.controller.ts
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

이 간단한 코드 안에 **모듈화, 의존성 주입, 데코레이터 기반 라우팅**이라는 NestJS의 정수가 모두 담겨 있다.

다음 아티클에서는 NestJS 프로젝트의 세부 디렉터리 구조와 `main.ts`에서 애플리케이션이 어떻게 기동되는지(Bootstrapping) 상세히 살펴본다.
