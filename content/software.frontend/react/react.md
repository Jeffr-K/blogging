React Hooks
useState

상태 초기화 / 업데이트
함수형 업데이트 setState(prev => ...)
객체 상태 불변성

useEffect

의존성 배열 (dependency array)
클린업 (cleanup)
무한 루프 주의
빈 배열 [] vs 없음 vs 값 있음

useRef

DOM 참조
렌더링 안 일으키는 값 저장
ref vs state 차이

useMemo

값 캐싱
의존성 배열
남용 주의

useCallback

함수 캐싱
의존성 배열
useMemo 와의 차이

useContext

Context 생성 / 소비
리렌더링 주의

useReducer

useState vs useReducer 선택 기준
action / dispatch 패턴
복잡한 상태 관리

useLayoutEffect

useEffect 와의 실행 타이밍 차이
DOM 측정할 때 사용

useTransition / useDeferredValue

우선순위 낮은 업데이트 처리
UI 블로킹 방지

커스텀 훅

로직 재사용
네이밍 규칙 use~
훅 합성


React 패턴
합성 (Composition)

children prop
컴포넌트를 prop으로 넘기기
HOC 대신 합성 선호 이유

고차 컴포넌트 (HOC)

컴포넌트를 받아 컴포넌트를 반환
언제 쓰고 언제 피하는지

렌더 프롭 (Render Props)

함수를 prop으로 넘기기
HOC와의 차이

복합 컴포넌트 (Compound Component)

<Select> / <Select.Option> 패턴
Context로 내부 상태 공유

제어의 역전 (Inversion of Control)

부모가 동작을 제어
유연한 컴포넌트 설계

관심사 분리

로직 훅으로 분리
UI 컴포넌트는 표현만


React 성능 최적화
리렌더링 이해

리렌더링이 발생하는 조건
참조 동일성 (Reference Equality)
부모 리렌더링 → 자식 리렌더링

React.memo

컴포넌트 메모이제이션
props 비교 방식
남용 시 오히려 손해인 이유

useMemo / useCallback 올바른 사용

언제 써야 하고 언제 쓰지 말아야 하는지
의존성 배열 관리

상태 위치 최적화

상태를 최대한 아래로 (State Colocation)
불필요하게 끌어올리지 않기

Context 리렌더링 문제

Context 값이 바뀌면 모든 소비자 리렌더링
분리 / 메모이제이션으로 해결

코드 스플리팅

React.lazy + Suspense
라우트 단위 분리

Key prop

리스트 렌더링 최적화
잘못된 key 사용 시 문제


React 19 추가 개념 인덱스
새로운 훅

use() — Promise나 Context를 직접 읽기
useActionState — 폼 액션 상태 관리
useFormStatus — 가장 가까운 폼의 pending/error 상태
useOptimistic — 낙관적 UI 업데이트

Actions

Server Actions ("use server")
폼에 async 함수 직접 연결
기존 REST API 대체 패턴

React Compiler

자동 메모이제이션 — useMemo, useCallback 수동 작성 불필요 DEV Community
기존 코드 변경 없이 자동 최적화

서버 컴포넌트 (안정화)

서버에서 렌더링, 클라이언트로 JavaScript 미전송 Vocal Media
서버 컴포넌트 vs 클라이언트 컴포넌트 경계

React 19.2 신규

Activity — 탭, 모달 등 staged UI 로딩에 활용 DEV Community
useEffectEvent — 반응형 로직과 이벤트 로직 분리 DEV Community
React Performance Tracks
Owner Stack (디버깅용, dev only)

렌더링

동시 렌더링 (Concurrent Rendering) 기본 활성화
자동 배칭 확장 — Promise, setTimeout, 네이티브 이벤트 핸들러까지 Vocal Media

라우팅 (React)

React Router v6 — useNavigate, useParams, useLocation, Outlet
TanStack Router — 타입 안전 라우팅
중첩 라우트 (Nested Routes)
동적 라우트 (Dynamic Routes)
보호된 라우트 (Protected Routes)
라우트 기반 코드 스플리팅

라우팅 (Next.js App Router)

<Link> 컴포넌트
useRouter, usePathname, useSearchParams
redirect(), notFound()
프리페칭 (Prefetching)
layout.tsx vs template.tsx 차이
loading.tsx, error.tsx, not-found.tsx
병렬 라우트 @slot
인터셉팅 라우트 (.)

URL / 쿼리 파라미터 상태

URL을 상태로 사용하는 패턴
searchParams 동기화
nuqs 라이브러리

데이터 페칭 패턴

워터폴 (Waterfall) vs 병렬 페칭
SWR
TanStack Query (useQuery, useMutation, useInfiniteQuery)
낙관적 업데이트 (Optimistic Update)
서버 상태 vs 클라이언트 상태 분리
폴링 (Polling) / 웹소켓

폼 처리

제어 컴포넌트 vs 비제어 컴포넌트
React Hook Form
Zod 스키마 유효성 검사
Server Actions + 폼 (React 19)
useFormStatus, useActionState

인증 (Auth)

세션 기반 vs JWT
NextAuth.js / Auth.js
미들웨어로 라우트 보호
쿠키 vs localStorage 토큰 저장

접근성 (a11y)

시맨틱 HTML
ARIA 속성
키보드 내비게이션
포커스 관리

SEO (Next.js)

metadata 객체
generateMetadata()
Open Graph / Twitter Card
sitemap.ts, robots.ts
구조화 데이터 (JSON-LD)

배포 / 인프라

Vercel 배포
환경변수 관리
Edge Runtime vs Node.js Runtime
next.config.js 설정
