---
title: "NestJS Deep Dive: reflect-metadata 라이브러리의 역할과 동작 원리"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "reflect-metadata", "decorators", "typescript"]
---

## 데이터 위의 데이터: 메타데이터(Metadata)

NestJS는 모든 것이 데코레이터(`@`)로 통한다. `@Module`, `@Injectable`, `@Controller` — 이 기호들은 단순한 장식이 아니다. 이들은 클래스에 특정한 **메타데이터(Metadata)**를 '태깅(Tagging)'하는 행위이며, 프레임워크는 이 태그를 읽어 런타임에 어떤 행동을 할지 결정한다.

이 마법 같은 메커니즘의 밑바닥에는 **`reflect-metadata`**라는 라이브러리가 있다. 이번 아티클에서는 `reflect-metadata`가 어떻게 TypeScript의 강력한 추상화를 런타임 데이터로 변환하는지 파헤쳐 본다.

---

## 1. reflect-metadata란 무엇인가?

TypeScript는 런타임에 타입 정보를 대부분 잃어버린다(Type Erasure). 하지만 우리가 `tsconfig.json`에서 `emitDecoratorMetadata` 옵션을 켜면, TypeScript 컴파일러는 데코레이터가 붙은 클래스나 멤버에 추가적인 정보를 새겨 넣는다.

이 정보를 **저장하고 조회하는 표준 API**를 제공하는 것이 바로 `reflect-metadata`다. ECMAScript의 공식 표준 후보이기도 하며, NestJS는 이 폴리필(Polyfill)을 통해 강력한 DI 시스템을 구축했다.

---

## 2. 런타임의 보이지 않는 레지스트리 (Registry)

`reflect-metadata`는 전역적인 **전용 저장소(Internal WeakMap)**를 관리한다.

우리가 `Reflect.defineMetadata(key, value, target)`을 호출하면, 특정 객체(`target`)와 연결된 비공개 슬롯에 데이터를 저장한다. NestJS는 이 슬롯을 이용해 '누가 어떤 서비스를 주입받아야 하는지'를 기록해 둔다.

```typescript
// NestJS 내부에서 일어나는 일 (개념적 코드)
@Injectable()
export class UsersService {}

// 실제로는 컴파일 시점에 이런 코드가 추가되는 것과 같다.
Reflect.defineMetadata('nest:injectable', true, UsersService);
```

---

## 3. design:* — TypeScript가 자동으로 남기는 흔적

가장 놀라운 점은 TypeScript 컴파일러가 자동으로 추가하는 메타데이터들이다.

1. **design:type**: 프로퍼티의 타입 정보.
2. **design:paramtypes**: 생성자나 메서드의 인자 타입 정보. (DI의 핵심!)
3. **design:returntype**: 메서드의 반환 타입 정보.

NestJS의 `InstanceLoader`가 생성자 인자를 보고 "아, `UsersService`가 필요하구나!"라고 아는 이유는, 클래스 수준에서 `Reflect.getMetadata('design:paramtypes', ...)`를 호출하여 주입해야 할 클래스 리스트를 런타임에 읽어오기 때문이다.

---

## 4. 메타데이터의 상속과 전파

메타데이터는 기본적으로 해당 객체에만 귀속되지만, NestJS는 이를 상속 구조에서도 유연하게 다룬다.

- **Class Level**: 클래스 전체의 성격을 규정 (예: `@Controller('/users')`)
- **Method Level**: 특정 동작을 규정 (예: `@Get(':id')`)
- **Property/Param Level**: 특정 필드나 인자의 주입 대상 규정 (예: `@Inject('MY_VAL')`)

NestJS의 `Scanner`는 이 계층 구조를 따라서 데이터를 수집하고 이를 기반으로 런타임 실행 스택(Execution Stack)을 구성한다.

---

## 요약

`reflect-metadata`는 NestJS라는 거대한 기계의 **'기억 장치'**와 같다. 데코레이터가 기록한 파편화된 정보들을 하나로 모아, 정적인 텍스트 였던 코드를 생동감 있게 움직이는 런타임 애플리케이션으로 변환하는 다리 역할을 수행한다.

이 메커니즘을 이해하면, 단순히 남이 만든 데코레이터를 쓰는 것을 넘어 우리가 직접 데이터를 클래스에 심고 이를 활용하는 **메타프로그래밍(Metaprogramming)**의 영역으로 진입할 수 있다.

다음 아티클에서는 NestJS가 이 복잡한 메타데이터 저장소에서 원하는 정보를 우아하게 추출하기 위해 제공하는 도구인 **`Reflector`** 클래스를 딥다이브해 본다.
