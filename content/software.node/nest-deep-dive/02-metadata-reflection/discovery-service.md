---
title: "NestJS Deep Dive: DiscoveryService를 이용한 전역 스캔 전략"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "discovery-service", "internals", "metaprogramming"]
---

## 컨테이너의 비밀을 탐험하다: DiscoveryService

NestJS는 모든 객체를 모듈 단위로 격리(Isolation)한다. 하지만 우리가 특정 데코레이터(예: `@OnEvent()`, `@Cron()`)를 만들고, **전체 애플리케이션에 등록된 모든 프로바이더**를 런타임에 훑으면서 이 데코레이터가 붙은 메서드를 찾아내고 싶다면 어떻게 해야 할까?

이때 우리를 도와주는 강력한 도구가 바로 **`DiscoveryService`**다. 이번 아티클에서는 `DiscoveryModule`을 사용하여 NestJS 컨테이너 내부의 모든 모듈, 프로바이더, 컨트롤러의 전체 목록에 접근하고 이를 조작하는 방법을 딥다이브해 본다.

---

## 1. DiscoveryService란 무엇인가?

`DiscoveryService`는 `@nestjs/core`에 포함되어 있어 별도로 설치할 필요가 없다. 이 서비스는 애플리케이션 시작 직후에 `NestContainer`가 가진 모든 정체들(Entities)에 접근할 수 있게 해준다.

```typescript
@Module({
  imports: [DiscoveryModule], // 1. DiscoveryModule을 임포트한다.
})
export class MyFeatureModule {}
```

---

## 2. 전역 스캔의 라이프사이클: OnModuleInit

`DiscoveryService`를 활용한 전역 스캔은 보통 **`OnModuleInit`** 훅에서 일어난다. 모든 프로바이더와 모듈이 로드되고 주입된 후에야 전체 목록을 훑을 수 있기 때문이다.

```typescript
export class MyScannerService implements OnModuleInit {
  constructor(private readonly discoveryService: DiscoveryService) {}

  onModuleInit() {
    // 2. 부트스트래핑 완료 후 모든 프로바이더를 훑는 이벤트를 시작한다.
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();
    
    // ... 분석 로직 ...
  }
}
```

---

## 3. 실전: 특정 데코레이터가 붙은 메서드 찾기

`MetadataScanner`와 결합하면 더욱 강력해진다.

1. **getProviders()**: 모든 프로바이더 인스턴스를 가져온다.
2. **MetadataScanner.getAllMethodNames()**: 각 인스턴스의 모든 메서드 이름을 가져온다.
3. **Reflector**: 해당 메서드에 우리가 만든 커스텀 데코레이터 메타데이터가 있는지 확인한다.

```typescript
// 내부 동작 순서
// 1. 모든 프로바이더 반복문 실행
providers.forEach(wrapper => {
  const { instance } = wrapper;
  if (!instance) return;
  
  // 2. 인스턴스의 모든 메서드 스캔
  const methods = this.metadataScanner.getAllMethodNames(Object.getPrototypeOf(instance));
  
  methods.forEach(method => {
    // 3. 특정 메타데이터가 붙었는지 확인
    const metadata = this.reflector.get(MY_DECORATOR_KEY, instance[method]);
    if (metadata) {
      // 4. 발견! 로직을 가로채거나 가공한다.
    }
  });
});
```

---

## 4. DiscoveryService의 내부 동작

`DiscoveryService`는 내부적으로 **`NestContainer`의 `getModules()`**를 호출한다. 각 모듈은 다시 자신의 프로바이더 리스트를 가지고 있으며, `DiscoveryService`는 이 계층 구조를 평탄화(Flatten)하여 우리에게 제공할 뿐이다.

동작 원리는 단순하지만, 그 결과는 매우 강력하다. 이 패턴은 NestJS 생태계의 수많은 라이브러리(`BullMQ`, `Swagger`, `EventEmitter2`)가 자동으로 동작하는 비결이기도 하다.

---

## 요약

`DiscoveryService`는 NestJS의 **공식적인 백도어(Backdoor)**와 같다. 모듈의 격리 정책을 존중하면서도, 필요한 경우 전체 컨테이너를 관찰하고 기능을 확장할 수 있는 유연성을 제공한다.

이 서비스를 자유자재로 다룬다면, 우리 팀만의 커스텀 프레임워크 도구를 구축하는 진정한 **'프레임워크 엔지니어'**의 반열에 오르게 된다.

다음 아티클에서는 이러한 모든 메타데이터 지식을 총동원하여, 실전에서 성능과 유지보수를 모두 잡는 **커스텀 데코레이터 설계법**을 딥다이브해 본다.
