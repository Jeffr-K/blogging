---
title: "NestJS Deep Dive: Pipe 시스템의 내부 구조와 동작 원리"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "pipe", "internals"]
---

## 파이프(Pipe)는 단순한 데이터 변환기가 아니다

많은 개발자들이 파이프를 단순히 "데이터 타입을 바꾸거나(Transformation)", "유효성을 검사하는(Validation)" 도구로만 이해한다. 하지만 딥다이브의 관점에서 파이프 시스템을 본다는 것은, NestJS가 런타임에 어떻게 파이프를 찾아내고, 어떤 순서로 실행하며, `ArgumentMetadata`를 어떻게 생성하여 주입하는지를 이해하는 것이다.

---

## 1. Pipe의 본질: PipesConsumer와 PipesContextCreator

NestJS 내부에서 파이프가 실행되는 과정은 크게 **생성(Creation)**과 **소비(Consumption)**의 단계로 나뉜다.

### PipesContextCreator (생성 및 메타데이터 추출)

애플리케이션이 부트스트래핑될 때, NestJS는 모든 컨트롤러의 메서드를 스캔한다. 이때 `PipesContextCreator`는 해당 메서드에 적용된 `@UsePipes()` 데코레이터와 파라미터 레벨의 데코레이터를 분석하여 실행 가능한 파이프들의 **콘텍스트(Context)**를 미리 구성한다.

### PipesConsumer (실행 엔진)

실제로 요청이 들어와 컨트롤러의 핸들러가 호출되기 직전, `PipesConsumer`가 등판한다. 이 클래스는 핸들러로 전달될 각 인자(Argument)마다 등록된 파이프들을 순차적으로 실행한다.

---

## 2. ArgumentMetadata의 비밀

우리가 커스텀 파이프를 만들 때 접하는 `ArgumentMetadata` 객체는 어떻게 만들어질까?

```typescript
export interface ArgumentMetadata {
  readonly type: 'body' | 'query' | 'param' | 'custom';
  readonly metatype?: Type<any>;
  readonly data?: string;
}
```

- **type**: `@Body()`, `@Query()`, `@Param()` 중 어떤 데코레이터로부터 왔는지를 나타낸다.
- **metatype**: TypeScript의 리플렉션 기능을 통해 추출된 인자의 타입 정보(Class)다. 이것이 가능하려면 `emitDecoratorMetadata`가 활성화되어 있어야 한다.
- **data**: 데코레이터에 전달된 문자열 인자다 (예: `@Param('id')`에서 `'id'`).

NestJS는 핸들러의 파라미터 리스트를 돌면서, 각 파라미터의 타입 정보를 `Reflect.getMetadata('design:paramtypes', ...)`를 통해 읽어와 이 메타데이터 객체를 구성한다.

---

## 3. 파이프의 실행 순서와 병합 로직

NestJS는 파이프를 다음의 3단계 계층으로 관리하며, 실행 시점에 이를 하나로 병합한다.

1. **Global Pipes**: `app.useGlobalPipes()`로 등록된 전역 파이프.
2. **Controller Pipes**: 컨트롤러 클래스 상단에 `@UsePipes()`로 등록된 파이프.
3. **Route/Parameter Pipes**: 특정 메서드나 파라미터(`@Body(MyPipe)`)에 등록된 파이프.

**내부 병합 로직**: 핸들러 호출 시, NestJS는 `[...global, ...controller, ...route, ...parameter]` 순서로 파이프 리스트를 평탄화(Flat)하여 배열을 만든 후, `reduce`와 같은 방식으로 이전 파이프의 결과물을 다음 파이프로 전달한다.

---

## 4. ValidationPipe의 내부: class-transformer와 class-validator의 결합

가장 많이 쓰이는 `ValidationPipe`가 내부적으로 어떻게 동작하는지 소스 코드 레벨에서 추론해 보자.

```typescript
// ValidationPipe 내부 로직의 간략화된 흐름
public async transform(value: any, { metatype }: ArgumentMetadata) {
  if (!metatype || !this.toValidate(metatype)) {
    return value;
  }
  
  // 1. plain-to-class 변환 (class-transformer)
  // 입력받은 단순 JSON 객체를 실제 클래스 인스턴스로 변환한다.
  const object = plainToInstance(metatype, value);
  
  // 2. 유효성 검사 (class-validator)
  // 클래스에 붙은 @IsString, @IsInt 등의 데코레이터를 기반으로 검증한다.
  const errors = await validate(object, this.validatorOptions);
  
  if (errors.length > 0) {
    throw new BadRequestException(this.flattenValidationErrors(errors));
  }
  
  // 3. 변환된 인스턴스 또는 원래 값을 반환
  return this.transformOptions.enableImplicitConversion ? object : value;
}
```

이 과정에서 핵심은 `plainToInstance`다. TypeScript는 런타임에 타입 정보를 잃어버리지만, `ValidationPipe`는 `metatype` 정보를 가지고 있기 때문에 런타임에도 어떤 클래스로 변환해야 할지 알 수 있는 것이다.

---

## 5. 딥다이브 포인트: 동적 파이프 주입

파이프 내부에 의존성을 주입하고 싶다면 어떻게 해야 할까? 파이프를 `@Injectable()`로 만들고 모듈의 프로바이더에 등록한 후, 컨트롤러 생성자에서 주입받아 사용할 수 있다.

하지만 `@UsePipes(MyPipe)`와 같이 클래스 자체를 넘겨줄 때는 NestJS가 내부적으로 **싱글톤인 경우 컨테이너에서 인스턴스를 가져오고**, 그렇지 않은 경우(매번 새로 생성해야 하는 경우) 직접 인스턴스화한다.

이때 파이프의 스코프가 `REQUEST`라면, 파이프 실행 성능에 직접적인 영향을 준다. 매 요청마다 파이프 인스턴스가 생성되고 소멸되기 때문이다.

---

## 요약

NestJS의 파이프 시스템은 **Reflect-metadata를 통한 타입 추출**, **계층별 파이프 병합 로직**, 그리고 **PipesConsumer에 의한 순차적 실행**이라는 정교한 구조 설계 위에 구현되어 있다.

이 구조를 이해하면 단순히 "왜 에러가 나지?"를 넘어, "이 파라미터에는 이 메타데이터가 이렇게 전달되겠구나"를 예측하며 설계할 수 있는 능력이 생긴다.
