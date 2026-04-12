---
title: "NestJS Deep Dive: 우리 팀만의 커스텀 프로젝트 템플릿 개발 가이드"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "schematics", "custom-template", "devops", "automation"]
---

## 지식의 자산화: 템플릿 자동화

모든 신규 프로젝트를 시작할 때마다 인증 처리, 공통 예외 필터, 로깅 인터셉터, 그리고 Docker 설정까지... 수동으로 복사해 붙여넣는 일은 이제 그만두어야 한다.

NestJS의 **커스텀 스키마틱스(Custom Schematics)**를 사용하면, `nest new`와 유사하게 우리 팀만의 표준 아키텍처와 보일러플레이트가 모두 포함된 프로젝트를 단 한 줄의 명령어로 생성할 수 있다. 이번 아티클에서는 지금까지 배운 `Tree`, `Rule`, `AST` 지식을 총동원하여 **실전 커스텀 프로젝트 템플릿**을 구축하는 로드맵을 딥다이브하며 본 테마를 마무리한다.

---

## 1. 커스텀 스키마틱스 프로젝트 생성하기

가장 먼저 스키마틱스 그 자체를 개발하기 위한 전용 프로젝트를 만든다.

```bash
npm install -g @angular-devkit/schematics-cli
schematics blank --name=my-nest-blueprint
```

이후 `collection.json` 파일에 `project` 또는 `application` 이라는 이름의 스키마틱스를 정의한다.

---

## 2. 실전: 템플릿 파일 구조 설계 (Blueprint)

주요 파일은 `files/` 폴더 내에 `.template` 확장자로 관리한다.

- **main.ts.template**: 우리 팀만의 전역 필터와 인터셉터가 미리 설정된 진입점.
- **docker-compose.yml.template**: 표준 DB 및 Redis 설정이 포함된 인프라 정의.
- **package.json.template**: 공통 라이브러리(Effect-TS, MikroORM 등)가 미리 포함된 패키지 명세.

---

## 3. 딥다이브: 동적 옵션 주입 전략

단순히 파일을 복사하는 대신, 사용자의 이름이나 프로젝트 환경에 따라 코드를 동적으로 생성한다.

```typescript
// index.ts (Schematic Factory)
export function myBlueprint(options: Schema): Rule {
  return chain([
    mergeWith(
      apply(url('./files'), [
        template({
          ...options,
          ...strings, // dasherize, classify 등 유틸리티 포함
        }),
        move(options.path || '.'),
      ]),
    ),
  ]);
}
```

---

## 4. 라이브러리 자동 설치와 스키마틱스 발행

코드 생성이 끝난 직후 `npm install`까지 자동으로 실행되도록 설정할 수 있다.

- **`NodePackageInstallTask`**: `@angular-devkit/schematics/tasks`에서 제공하는 태스크를 사용하여, 사용자가 직접 패키지를 설치할 필요 없이 프로젝트를 즉석에서 실행 가능한 상태로 만든다.

---

## 요약

우리 팀만의 커스텀 프로젝트 템플릿을 갖는다는 것은 다음과 같은 가치를 의미한다.

- **표준화**: 모든 팀원이 동일한 아키텍처 가이드라인 내에서 개발을 시작한다.
- **생산성**: 설정에 낭비되는 수십 시간을 비즈니스 로직에 집중하는 시간으로 전환한다.
- **품질**: 검증된 공통 코드와 보안 설정이 신규 프로젝트에 즉시 적용된다.

이로써 스키마틱스와 CLI 확장 테마를 성공적으로 정복했다. 다음 테마는 실제 운영 환경에서의 완성도를 결정짓는 **성능 최적화와 메모리 프로파일링**의 심연입니다.
