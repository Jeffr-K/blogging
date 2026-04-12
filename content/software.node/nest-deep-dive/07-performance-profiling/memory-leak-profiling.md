---
title: "NestJS Deep Dive: 실전 힙 덤프(Heap Dump) 분석과 메모리 릭 해결"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "heap-dump", "memory-leak", "profiling", "internals"]
---

## 메모리의 공포: 릭(Leak)의 발견

모든 서비스는 처음에는 건강하다. 하지만 시간이 지나면서 서버의 메모리 사용량이 조금씩 우상향하고 있다면? 결국 **Out of Memory (OOM)** 에러와 함께 서버는 작렬히 전사할 것이다.

NestJS 애플리케이션에서 발생하는 메모리 릭은 대부분 잘못된 전역 객체 참조, 해제되지 않은 인터벌(Interval), 혹은 클로저(Closure) 내의 대량 데이터 보존에서 기인한다. 이번 아티클에서는 **힙 덤프(Heap Dump)**를 뜨고 이를 시각적으로 분석하여 범인을 찾아내는 실전 프로파일링 과정을 딥다이브하며 본 테마를 마무리한다.

---

## 1. 힙 덤프 뜨기: heapdump vs v8.getHeapSnapshot()

메모리 릭을 분석하기 위해 현재 메모리의 모든 객체 상태를 저장한 파일이 힙 덤프다.

```typescript
// Node.js v12 이상 내장 API 사용 권장
import { writeHeapSnapshot } from 'v8';

@Controller('admin')
export class AdminController {
  @Get('heapdump')
  takeHeapdump() {
    // 덤프를 생성하고 로컬 파일로 저장
    const filePath = writeHeapSnapshot();
    return { status: 'success', path: filePath };
  }
}
```

- **유의**: 힙 덤프는 생성되는 동안 전체 쓰레드가 멈추므로(Pause), 반드시 프로덕션 환경의 트래픽이 적을 때나 격리된 서버에서 수행해야 한다.

---

## 2. 딥다이브: 덤프 비교(Comparison) 전략

하나의 덤프 파일만으로는 무엇이 릭인지 알 수 없다. **'두 시점 사이의 차이'**를 보는 것이 핵심이다.

1. **Snapshot 1**: 서버 기동 직후 (Baseline)
2. **Snapshot 2**: 다량의 트래픽을 처리한 후 (Peak)
3. **Snapshot 3**: 모든 요청이 완료되고 GC가 한 번 돌았을 때 (After GC)

이 Snapshot 3에서 여전히 메모리를 점유하고 있는 객체가 있다면, 그것이 바로 **메모리 릭**의 후보다.

---

## 3. Chrome DevTools를 통한 시각적 분석

1. Chrome 브라우저에서 `chrome://inspect` 이동.
2. `Open dedicated DevTools for Node` 클릭 후 `Memory` 탭 선택.
3. 저장한 `.heapsnapshot` 파일을 로드.
4. **`Comparison`** 뷰를 선택하고 이전 스냅샷과 비교.
5. **`Retainers`** 확인: 특정 객체가 왜 지워지지 않고 주소값을 물고 있는지(Root 객체와의 연결 고리) 추적.

---

## 4. 실전 사례: NestJS에서의 흔한 릭 패턴

- **전역 프로바이더의 맵 오남용**: `Map`에 데이터를 계속 넣기만 하고 명시적으로 지우지 않는 경우.
- **RxJS Subject의 구독 미해지**: 수동으로 구독(`subscribe()`)한 스트림이 `OnModuleDestroy`에서 적절히 해지되지 않았을 때.
- **순환 의존성 해결용 클로저**: `forwardRef`로 인해 생겨난 클로저 내에서 의도치 않게 대량의 메모리 데이터를 웅켜쥐고 있는 상황.

---

## 요약

메모리 프로파일링은 **"추측하지 말고 증거를 찾는 것"**이다.

- `v8.getHeapSnapshot()`으로 주기적인 메모리 체크포인트를 확보하자.
- Chrome DevTools의 `Comparison`과 `Retainers` 뷰를 능숙하게 다루자.
- NestJS 프로바이더와 RxJS 스트림의 생명주기를 완벽하게 관리하자.

이 테마를 통해 우리는 보이지 않는 메모리의 세계를 숫자로 들여다보고, 애플리케이션의 영구적인 안정성을 확보하는 진정한 **'사이트 신뢰성 엔지니어(SRE)'**의 눈을 갖게 되었다.

지금까지 성능과 프로파일링 테마를 성공적으로 정복했다. 마지막 딥다이브 테마는 견고한 코드를 위한 최종 관문인 **내부 테스팅 전략**입니다.
