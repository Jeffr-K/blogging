---
title: "Next.js 특화 테스팅: 서버 컴포넌트(RSC)와 SSR 환경의 검증 전략"
author: jeffrey
date: 2026-04-13
tags: ["nextjs", "server-components", "rsc-testing", "msw", "ssr"]
---

## Next.js 특화 테스팅: 서버 컴포넌트(RSC)와 SSR 환경의 검증 전략

Next.js App Router의 도입으로 프론트엔드 테스팅의 지형이 완전히 바뀌었습니다. 컴포넌트가 브라우저가 아닌 **'서버'**에서 실행되기 시작했기 때문입니다. 기존의 React Testing Library만으로는 서버 전용 로직이나 데이터 페칭을 완벽히 검증하기 어렵습니다.

이 아티클에서는 현대적 Next.js 환경에서 테스트를 설계하는 시니어의 전략을 다룹니다.

---

### 1. 서버 컴포넌트(React Server Components) 테스팅

RSC는 `async/await`을 사용하여 데이터를 직접 가져옵니다. 이를 테스트하려면 비동기 컴포넌트를 렌더링할 수 있는 환경이 필요합니다.

#### ❌ 문제 상황

```tsx
// ProfilePage.tsx - 서버 컴포넌트
export default async function ProfilePage() {
  const user = await db.user.findUnique(...); // 서버 사이드 DB 접근
  return <div>{user.name}</div>;
}
```

일반적인 `render(<ProfilePage />)`는 실패합니다. 서버 전용 API(db, fs 등)가 테스트 환경(JSDOM)에 없기 때문입니다.

#### ✅ 해결 전략: 환경의 분리

서버 컴포넌트는 두 가지 방식으로 검수합니다.

1. **단위 테스트**: 컴포넌트 내부의 비즈니스 로직(데이터 가공 등)을 순수 함수로 추출하여 테스트합니다.
2. **통합 테스트**: 실제 서버 환경을 최대한 모사하거나(Playwright/Cypress), 서버 컴포넌트를 일반 비동기 함수처럼 호출하여 리턴된 JSX 구조를 검증합니다.

---

### 2. MSW(Mock Service Worker)를 통한 네트워크 모킹

서버 사이드 페칭(fetch)을 테스트할 때 가장 강력한 도구는 **MSW**입니다. MSW는 네트워크 단에서 요청을 가로채기 때문에 클라이언트 컴포넌트와 서버 컴포넌트 모두에서 동일하게 작동합니다.

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://api.example.com/user', () => {
    return HttpResponse.json({ name: 'Jeffrey' });
  }),
];

// 이 설정을 통해 fetch() 요청은 실제 서버가 아닌 MSW 핸들러로 향하게 됩니다.
```

---

### 3. Next.js 내장 함수 모킹 (`usePathname`, `useRouter`)

`next/navigation`의 훅들은 Next.js 런타임 밖에서는 동작하지 않습니다.

```tsx
import { vi } from 'vitest';

// useRouter 모킹 예시
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/dashboard',
}));
```

---

### 4. Senior's Insight: 테스팅 피라미드 재구성

Next.js 환경에서는 전통적인 테스팅 피라미드보다 **'테스팅 트로피(Testing Trophy)'** 모델이 더 적합합니다.

- **Static**: TypeScript로 타입 무결성 확보.
- **Unit**: 복잡한 계산식, 공통 유틸리티 함수.
- **Integration (RTL + MSW)**: 사용자의 주요 시나리오(여러 컴포넌트의 유기적 동작)를 가장 많이 테스트해야 합니다. **이것이 가성비가 가장 좋습니다.**
- **E2E (Playwright)**: 서버와 실제 DB까지 연결된 치명적인 경로(결제 성공, 회원가입 등) 검증.

특히 Next.js에서는 **'서버와 클라이언트의 경계'**에서 발생하는 버그가 많습니다. 예를 들어, 서버에서 전달한 Date 객체가 클라이언트에서 직렬화(Serialization) 오류를 일으키는 경우입니다. 이런 버그는 오직 통합 테스트나 E2E에서만 발견됩니다.

---

### 결론: Next.js 테스트는 '연결'의 검증이다

단순히 UI가 예쁘게 나오는지는 Storybook으로 충분합니다. Next.js에서의 테스트는 **데이터가 서버에서 클라이언트로, 다시 서버로 흐르는 그 파이프라인이 끊어지지 않았음을 증명하는 과정**이어야 합니다. 서버 컴포넌트를 두려워하지 말고, MSW와 적절한 모킹 전략으로 경계를 허무십시오.

---

> [!NOTE]
> 마지막 아티클에서는 지금까지 배운 모든 기술을 총동원하여, 복잡한 비즈니스 폼과 전역 상태 관리가 얽힌 실전 시나리오를 정복해 봅니다.
