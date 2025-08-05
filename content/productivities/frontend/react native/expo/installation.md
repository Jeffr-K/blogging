---
title: React Native Installation
---

# React Native 2025

# Installation

```bash
$ npx create-expo-app@latest
```

# Expo CLI

### Pros

- 빠른 프로젝트 설정과 개발 시작

- 간편한 빌드 및 배포 프로세스

- 풍부한 내장 API와 컴포넌트

- OTA 업데이트 지원

- Config Plugins를 통한 네이티브 모듈 통합 가능

- 자동화된 빌드 인프라 제공

### Cons

### 생성된 폴더 구조

```bash
my-app/
├── app/               # Expo Router 기반 페이지
│   ├── (tabs)/
│   ├── +html.tsx
│   ├── +layout.tsx
│   ├── _layout.tsx    # 탭 네비게이션 그룹
│   ├── modal.tsx      # 모달 스택
│   └── [dynamic]/     # 동적 라우트
│
├── components/        # 재사용 컴포넌트
├── constants/         # 상수
├── hooks/             # 커스텀 훅
├── providers/         # 컨텍스트 프로바이더
├── services/          # API 및 외부 서비스
├── stores/            # 상태 관리
├── types/             # TypeScript 타입
├── utils/             # 유틸리티 함수
├── assets/            # 이미지, 폰트 등
└── app.json           # Expo 설정
```

# Expo Start

아래의 명령어를 실행하면 Expo 로 구성된 앱이 바로 실행된다.

```bash
$ cd my-app
$ npx expo start
```


# References

- [2025년 리액트 네이티브로 프로젝트 시작하기](https://ykss.netlify.app/devlog/start_with_RN/)
