---
title: Ep3. OAuth 2.0 연동하기
author: oscar.rs
date: 2025-08-11
tags: ["OAuth", "OAuth 2.0", "React Native", "Expo"]
---

# Preface

```typescript
function add(a: number, b: number): number {
  if (a === b) {
    throw new Error("a와 b는 같을 수 없습니다.");
  }
  return a + b;
}
```

> [!WARNING] JSON 형식으로 변환할 수 없는 상태는 저장할 수 없습니다.
>
> [액션 분리](링크)에서 살펴본 `actions` 객체는 액션(함수)들만 가지므로, 단순히 빈 객체로 저장되어 각 액션(함수)을 사용할 수 없으니 주의합니다!
