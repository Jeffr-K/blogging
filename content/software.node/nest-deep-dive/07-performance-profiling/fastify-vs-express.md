---
title: "NestJS Deep Dive: Fastify 어댑터 도입과 성능 최적화"
author: anonymous.rs
date: 2026-04-06
tags: ["nest-js", "deep-dive", "fastify", "express", "performance", "internals"]
---

## 두 어댑터 모델: Express vs Fastify

NestJS는 기본적으로 **Express** 위에서 작동한다. 하지만 처리 속도가 수 배 빠르다고 알려진 **Fastify**로의 전환은 어떤 내부 변화를 가져올까?

왜 Fastify가 더 빠른지, 그리고 단순히 `NestFactory.create<NestFastifyApplication>`으로 바꾸는 것만으로 모든 것이 해결되는지 그 이면의 기술적 차이점을 딥다이브해 본다.

---

## 1. Fastify의 성능 비결: 데이터 매핑과 스키마

- **Ajv (Another JSON Schema Validator)**: Fastify는 응답을 보낼 때 데이터를 JSON으로 직렬화(Serialization)하는 과정을 미리 컴파일된 스키마로 최적화한다.
- **Find-My-Way**: Express의 정규표현식 기반 라우팅보다 훨씬 빠른 **트라이(Trie)** 구조의 라우터 엔진을 사용한다.
- **Node.js 원시 소켓**: 중첩된 미들웨어 레이어를 줄이고 직접적인 소켓 제어 성능을 높였다.

---

## 2. 딥다이브: NestJS 어댑터(Adapter)의 역할

NestJS는 내부적으로 `HttpAdapter` 인터페이스를 제공한다.

1. **get() / post()**: 우리가 컨트롤러에 `@Get()`을 쓰면 어댑터는 이를 `fastify.get()` 또는 `express.get()`으로 변환한다.
2. **reply()**: 결과물을 돌려줄 때 어댑터는 `res.send()`(Express) 또는 `reply.send()`(Fastify)를 호출한다.

이 추상화 덕분에 우리는 코드를 거의 바꾸지 않고도 하부 엔진을 교체할 수 있지만, **타입(Type)**은 다르다는 점에 주의해야 한다. Fastify는 `req`와 `res` 객체의 구조가 Express와 완전히 다르다.

---

## 3. 전환 시의 유의사항과 호환성

- **Middleware**: Express 전용 미들웨어는 Fastify에서 바로 쓸 수 없다. Fastify는 독자적인 플러그인 시스템(`fastify-plugin`)을 가지기 때문이다.
- **File Upload**: `Multer`는 Express 기반이다. Fastify로 전환하면 `fastify-multipart` 등을 사용해야 하며, NestJS 레벨에서는 전용 인터셉터를 새로 구축해야 한다.
- **Body Parsing**: Fastify는 기본적으로 대용량 페이로드를 받을 때 더 엄격한 제한을 둔다. (`bodyLimit` 설정 필요)

---

## 4. 실전 최적화: 스키마 시리얼라이제이션 활용

Fastify의 진정한 속도를 누리려면, NestJS의 `ClassSerializerInterceptor` 대신 Fastify의 **네이티브 JSON 스키마 시리얼라이제이션** 성능을 끌어올려야 한다.

- **방법**: 응답 DTO를 `class-transformer`로 변환하는 오버헤드마저 줄이고 싶다면, Fastify 어댑터 레벨에서 미리 컴파일된 스키마를 사용하여 출력 성능을 정교하게 튜닝할 수 있다.

---

## 요약

Fastify 전환은 단순한 엔진 교체가 아니라, **"오버헤드를 걷어내는 과정"**이다.

- 라우팅과 직렬화 성능의 극대화
- Express 호환성을 포기하는 대신 얻는 높은 처리량(Throughput)
- 대규모 API 환경에서의 낮은 응답 지연 시간(Low Latency)

이 지식을 바탕으로 프로젝트의 트래픽 특성을 분석하여, 안주하는 Express를 떠나 더 도전적이고 성능 지향적인 Fastify의 세계로 당당히 나아갈 수 있게 된다.

다음 아티클에서는 이러한 모든 성능 지식의 최종 단계인 **힙 덤프(Heap Dump) 분석과 메모리 릭(Memory Leak) 해결 전략**을 딥다이브하며 본 테마를 마무리한다.
