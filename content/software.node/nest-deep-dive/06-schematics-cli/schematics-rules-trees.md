---
title: "NestJS Deep Dive: 스키마틱스 Rule과 Tree 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "schematics", "rule", "tree", "internals"]
---

## 가상 파일 시스템의 마법: Tree와 Rule

스키마틱스가 코드를 생성할 때, 실제 하드디스크에 파일을 즉시 쓰지 않는다. 대신 **`Tree`**라고 불리는 가상 파일 시스템(Virtual File System) 위에서 작업을 수행한다. 그리고 이 `Tree`를 변형시키는 모든 행위는 **`Rule`**이라는 함수로 정의된다.

왜 이런 복잡한 구조를 선택했을까? 바로 **'원자성(Atomicity)'** 때문이다. 여러 파일이 생성되다가 하나라도 실패하면, 전체 작업을 롤백(Rollback)해야 하기 때문이다. 이번 아티클에서는 스키마틱스의 두 핵심 개념인 `Tree`와 `Rule`을 딥다이브해 본다.

---

## 1. Tree: 보이지 않는 파일 시스템

`Tree`는 현재 파일 시스템의 스냅샷(Snapshot)이다.

- **Staging Area**: `Tree`에 가해지는 모든 변경사항(파일 생성, 수정, 삭제)은 스테이징 상태로 관리된다.
- **내부 동작**: 스키마틱스 실행이 모두 끝나야만 이 스테이징 내역이 실제 파일 시스템에 반영(`commit`)된다. 이 과정은 데이터베이스의 트랜잭션과 동일하게 동작한다.

---

## 2. Rule: Tree를 변형하는 순수 함수

`Rule`은 단순한 함수다: `Rule = (tree: Tree, context: SchematicContext) => Tree | Observable<Tree>`.

- **함수형 사고**: `Rule`은 `Tree`를 매개변수로 받아, 수정한 뒤 새로운 `Tree`를 반환한다.
- **체이닝(Chaining)**: 여러 `Rule`을 `chain()` 함수로 묶어 복잡한 작업을 단계별로 수행할 수 있다.

```typescript
// Rule의 개념적 예시
export function createMyFile(options: any): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    tree.create('/test.ts', `export const name = "${options.name}";`);
    return tree;
  };
}
```

---

## 3. 딥다이브: 템플릿의 지능적 적용 (apply)

실제 스키마틱스 구현에서 가장 많이 사용하는 `apply`와 `template` 도구는 다음과 같은 순서로 동작한다.

1. **url()**: 소스 템플릿 파일들의 경로를 읽어온다.
2. **applyTemplates()**: 템플릿 내의 `<%= name %>` 같은 변수를 사용자가 입력한 데이터로 치환한다.
3. **move()**: 생성된 파일을 원하는 경로(예: `src/users`)로 이동시킨다.
4. **mergeWith()**: 이 모든 작업이 완료된 가상 트리를 기존의 `Tree`와 병합한다.

---

## 4. 실전 활용: 조건부 파일 생성 전략

명령어 옵션(`--test=false`)에 따라 테스트 파일을 만들지 말지 결정하는 지능형 `Rule`도 쉽게 만들 수 있다.

- **`filter()`**: 특정 조건이 맞지 않으면 `Tree`에서 해당 파일을 제외시킨다.
- **`noop()`**: 아무 일도 하지 않고 `Tree`를 그대로 통과시킨다.

---

## 요약

`Tree`와 `Rule`은 스키마틱스라는 거대한 기계의 **'데이터'**와 **'연산'**이다.

- `Tree`는 가상 파일 시스템을 통해 안전한 코드 생성을 보장한다.
- `Rule`은 순수 함수로서 코드 변조의 논리적 단위를 구성한다.
- 이 둘의 결합을 통해 우리는 복잡한 프로젝트 구조 설계도 한치의 오차 없이 자동화할 수 있다.

이 구조를 이해하면 "왜 내 스키마틱스가 중간에 에러가 났을 때 아무 파일도 생기지 않는지"에 대한 명확한 기술적 근거를 가질 수 있게 된다.

다음 아티클에서는 이러한 단순한 파일 생성을 넘어, 기존 소스 코드를 똑똑하게 파싱하고 수정하는 기술인 **AST(추상 구문 트리) 조작 기법**을 딥다이브해 본다.
