---
title: "NestJS Deep Dive: nest-cli 내부 동작 원리와 스키마틱스 설계"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "nest-cli", "schematics", "internals"]
---

## 코드 그 이상의 코드: 스키마틱스(Schematics)

`nest generate controller users` — 이 마법 같은 한 줄 명령어로 `users.controller.ts` 파일이 생기고, `app.module.ts`에 자동 등록되는 원리는 무엇일까?

단순히 텍스트를 복사해 넣는 것일까? 아니다. 그 뒤에는 엔지니어링 수준의 **코드 조작 엔진인 스키마틱스(Schematics)**가 있다. 이번 아티클에서는 `nest-cli`가 어떻게 우리 대신 코드를 작성(Automation)해 주는지, 그 내부 부트로더와 스키마 설계 원리를 딥다이브해 본다.

---

## 1. nest-cli의 정체: Schematic Runner

`nest-cli`는 독자적인 엔진이 아니다. 내부적으로는 Angular 팀이 만든 `@angular-devkit/schematics`라는 강력한 워크플로우 엔진을 활용하는 **러너(Runner)**다.

1. 사용자가 명령어를 입력한다.
2. `nest-cli`는 `@nestjs/schematics` 패키지에서 해당 스키마틱스 정의(Collection)를 찾는다.
3. 엔진은 이 정의를 기반으로 가상 파일 시스템(Tree) 위에서 코드를 생성하고 가공한다.

---

## 2. 딥다이브: 스키마틱스 컬렉션(Collection) 구성

하나의 스키마틱스는 다음과 같은 구조로 이루어진다.

- **collection.json**: 어떤 명령어가 어떤 공장(Factory)과 연결되는지 정의하는 지도.
- **schema.json**: 명령어 인자(Arguments)와 옵션들의 스펙 정의.
- **index.ts (Factory)**: 실제 코드를 생성하는 비즈니스 로직(Rule)이 담긴 곳.
- **files/**: 파일 생성을 위한 템플릿 파일들 (`.ts.template`).

---

## 3. 템플릿 엔진의 원리: EJS와 변수 주입

스키마틱스 내의 템플릿 파일들을 열어보면 `<%= name %>` 같은 기이한 문법이 가득하다.

```typescript
// users.controller.ts.template
@Controller('<%= dasherize(name) %>')
export class <%= classify(name) %>Controller {}
```

- **dasherize**: `UsersService`를 `users-service`로 변환.
- **classify**: `users`를 `Users`로 변환.

스키마틱스 엔진은 명령어에서 받은 문자열을 이런 유틸리티 함수로 가공하여, 템플릿의 변수 자리에 쏙 채워 넣는 정교한 텍스트 변환 과정을 거친다.

---

## 4. 횡단적 코드 주입: 자동 모듈 등록 (Action)

가장 놀라운 기능은 파일을 만드는 것에 그치지 않고, 기존 파일(`app.module.ts`)을 **수정**하는 능력이다.

- **내부 동작**: 엔진은 기존 모듈 파일을 읽어와 파싱(Parsing)하고, `imports` 배열의 위치를 정확히 찾아 새로운 모듈 클래스를 한 줄 끼워 넣는다. 이 과정은 실패 시 전체 작업이 롤백(Rollback)되는 트랜잭션 단위로 일어난다.

---

## 요약

`nest-cli`와 스키마틱스는 **"지루한 보일러플레이트로부터의 해방"**을 의미한다.

- `@angular-devkit/schematics` 기반의 트랜잭션 코드 생성 엔진 이해
- 템플릿과 메타데이터(`schema.json`)를 통한 유연한 코드 정의
- 자동 모듈 등록과 같은 기존 파일 조작 메커니즘의 실체

이 내부 구조를 안다면, 이제 단순히 남이 만든 스키마틱스를 쓰는 것을 넘어, 우리 팀의 아키텍처 가이드를 코드로 강제하는 **우리만의 CLI 도구**를 만들 준비가 된 것이다.

다음 아티클에서는 이러한 스키마틱스의 심장인 **Rule과 Tree를 활용한 지능형 코드 생성 전략**을 딥다이브해 본다.
