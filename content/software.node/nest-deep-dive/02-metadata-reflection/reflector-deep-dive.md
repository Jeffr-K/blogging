---
title: "NestJS Deep Dive: Reflector 클래스 완벽 분석"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "reflector", "metadata", "internals"]
---

## 메타데이터의 안내자: Reflector

`reflect-metadata`는 메타데이터를 저장하는 하부 저장소라면, **`Reflector`**는 NestJS가 이 저장소에서 데이터를 안전하고 우아하게 읽어오기 위해 제공하는 **표준 인터페이스**다.

전역 가드(Global Guards)에서 특정 라우터의 권한 설정을 읽거나, 인터셉터에서 컨트롤러에 설정된 캐시 옵션을 가져올 때 우리는 늘 `Reflector`를 주입받아 사용한다. 이번 아티클에서는 `Reflector`가 제공하는 세 가지 핵심 메서드(`get`, `getAll`, `getAllAndOverride`)의 내부 차이와 사용 전략을 딥다이브해 본다.

---

## 1. Reflector.get() — 기본 추출

가장 기본적인 메서드다. 지정한 키와 타겟(클래스나 메서드)에서 메타데이터를 직접 읽어온다.

```typescript
const roles = this.reflector.get<string[]>('roles', context.getHandler());
```

- **동작**: `Reflect.getMetadata('roles', target)`과 거의 동일하지만, NestJS 컨테이너와 연동되어 타입 안전성을 제공한다.
- **용도**: 단일 메서드나 단일 클래스의 메타데이터만 필요할 때 사용.

---

## 2. Reflector.getAll() — 메타데이터의 누적 (Merging)

하나의 요청은 **컨트롤러(Class)**와 **핸들러(Method)**라는 두 계층을 거친다. `@Roles('admin')`이 클래스에도 붙어 있고 메서드에도 붙어 있다면 어떻게 될까?

```typescript
const roles = this.reflector.getAll<string[]>('roles', [
  context.getHandler(),
  context.getClass(),
]);
```

- **동작**: 배열로 전달된 모든 타겟에서 메타데이터를 추출하여 **리스트로 반환**한다. 리스트 내의 순서는 타겟 배열의 순서와 동일하다(`[method_roles, class_roles]`).
- **용도**: 클래스 레벨의 권한과 메서드 레벨의 권한을 합체하여(Union) 검증해야 할 때 유용하다.

---

## 3. Reflector.getAllAndOverride() — 우선순위의 결정

실무에서 가장 많이 쓰이는 패턴이다. "클래스에 기본 설정이 있지만, 메서드에 별도 설정이 있다면 **메서드 설정을 우선**하겠다"는 로직을 한 줄로 끝내준다.

```typescript
const roles = this.reflector.getAllAndOverride<string[]>('roles', [
  context.getHandler(),
  context.getClass(),
]);
```

- **동작**: 배열의 첫 번째 요소부터 확인하며 메타데이터가 발견되는 즉시 반환하고 종료한다. 즉, `[handler, class]` 순서로 넣으면 핸들러의 데이터가 클래스의 데이터를 **오버라이드(Override)**하게 된다.
- **용도**: 공통 정책을 클래스에 선언하고, 특정 API에서만 예외 처리를 하고 싶을 때 최적이다.

---

## 4. Reflector.getAllAndMerge() — 데이터의 병합 (Merging)

각 계층의 데이터를 단순히 리스트로 나열하는 것이 아니라, 하나의 배열로 합치고 싶을 때 사용한다.

- **동작**: 클래스와 메서드의 데이터를 모두 가져와 하나의 긴 배열로 평탄화(Flat)한다.
- **용도**: 허용된 모든 권한 리스트를 합산할 때 사용.

---

## 결론: 어떤 도구를 선택해야 하는가?

- **단순성**: `get()`
- **예외 처리와 우선순위**: `getAllAndOverride()` (가장 권장되는 실무 패턴)
- **누적 관리**: `getAll()` 또는 `getAllAndMerge()`

`Reflector`는 단순한 유틸리티 클래스가 아니다. NestJS가 **'선언적 프로그래밍(Declarative Programming)'**을 실현하게 해주는 핵심 도구다. 데코레이터로 의도를 선언하고, `Reflector`로 그 의도를 읽어 런타임 로직을 완성하는 것 — 이것이 바로 상급 개발자로 가는 첫 단추다.

다음 아티클에서는 이러한 메타데이터 정보를 바탕으로, 컨테이너 내의 모든 프로바이더를 런타임에 전수 조사할 수 있는 강력한 기능인 **`DiscoveryService`**를 딥다이브해 본다.
