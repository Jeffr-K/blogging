---
title: "[React 패턴 시리즈] 10. forwardRef: 부모가 자식의 DOM에 접근하는 방법"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "forwardRef", "ref", "DOM"]
---

# forwardRef: 부모가 자식의 DOM에 접근하는 방법

`useRef`로 DOM에 접근할 때, `ref`를 같은 컴포넌트 안에서 쓰면 간단합니다. 그런데 **부모 컴포넌트에서 자식 컴포넌트 내부의 DOM 요소**에 접근하려면 어떻게 해야 할까요? `ref`는 일반 prop처럼 전달되지 않습니다. 이때 `forwardRef`를 사용합니다.

## 문제: ref는 prop으로 전달되지 않는다

```jsx
function Input({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}

function Form() {
  const inputRef = useRef(null);
  return <Input ref={inputRef} />; // ref가 전달되지 않음!
}
```

React에서 `ref`는 특별한 속성입니다. `key`처럼 props 객체에 포함되지 않아서, 자식 컴포넌트가 그냥 받을 수 없습니다.

## forwardRef로 해결

`forwardRef`로 컴포넌트를 감싸면, 두 번째 인자로 `ref`를 받을 수 있습니다.

```jsx
import { forwardRef } from 'react';

const Input = forwardRef(function Input(props, ref) {
  return <input ref={ref} {...props} />;
});

// 이제 부모에서 ref를 전달할 수 있음
function Form() {
  const inputRef = useRef(null);

  function handleSubmit() {
    inputRef.current.focus(); // 자식의 input DOM에 직접 접근
  }

  return (
    <>
      <Input ref={inputRef} placeholder="이름 입력" />
      <button onClick={handleSubmit}>포커스</button>
    </>
  );
}
```

## 실전 예제: 디자인 시스템 Input 컴포넌트

공통 Input 컴포넌트를 만들 때 forwardRef는 거의 필수입니다. 폼 라이브러리들이 내부적으로 ref를 사용하기 때문입니다.

```jsx
const TextInput = forwardRef(function TextInput(
  { label, error, ...props },
  ref
) {
  return (
    <div className="input-wrapper">
      {label && <label>{label}</label>}
      <input
        ref={ref}
        className={error ? 'input-error' : 'input'}
        {...props}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  );
});

// React Hook Form 같은 라이브러리와도 잘 동작
function SignUpForm() {
  const { register } = useForm();
  return (
    <TextInput
      label="이메일"
      {...register('email')} // register 내부에서 ref 사용
    />
  );
}
```

## useImperativeHandle: 노출할 메서드 직접 정의

`forwardRef`를 사용하면 부모가 DOM 전체에 접근할 수 있습니다. 하지만 때로는 특정 메서드만 노출하고 싶을 때가 있습니다. `useImperativeHandle`을 함께 사용합니다.

```jsx
const VideoPlayer = forwardRef(function VideoPlayer(props, ref) {
  const videoRef = useRef(null);

  // ref로 노출할 메서드를 직접 정의
  useImperativeHandle(ref, () => ({
    play() {
      videoRef.current.play();
    },
    pause() {
      videoRef.current.pause();
    },
    // DOM 전체가 아니라 정의한 메서드만 외부에 노출
  }));

  return <video ref={videoRef} src={props.src} />;
});

// 부모에서 사용
function App() {
  const playerRef = useRef(null);

  return (
    <>
      <VideoPlayer ref={playerRef} src="/video.mp4" />
      <button onClick={() => playerRef.current.play()}>재생</button>
      <button onClick={() => playerRef.current.pause()}>일시정지</button>
    </>
  );
}
```

`videoRef.current`의 모든 DOM API가 노출되는 대신, `play()`와 `pause()`만 사용할 수 있습니다. 컴포넌트의 내부 구현을 캡슐화합니다.

## React 19의 변화

React 19부터는 `forwardRef` 없이 `ref`를 일반 prop처럼 받을 수 있게 됩니다.

```jsx
// React 19+: forwardRef 불필요
function Input({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}
```

하지만 React 18 이하에서는 여전히 `forwardRef`가 필요합니다.

## 정리

- `ref`는 일반 prop으로 전달되지 않습니다
- `forwardRef`로 컴포넌트를 감싸면 두 번째 인자로 `ref`를 받을 수 있습니다
- 디자인 시스템 컴포넌트, 폼 라이브러리 연동에 자주 필요합니다
- `useImperativeHandle`로 노출할 메서드를 제한하면 내부 구현을 캡슐화할 수 있습니다
