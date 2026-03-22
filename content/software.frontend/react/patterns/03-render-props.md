---
title: "[React 패턴 시리즈] 3. 렌더 프롭 (Render Props): 함수로 렌더링 위임하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "render-props", "렌더프롭", "재사용"]
---

# 렌더 프롭 (Render Props): 함수로 렌더링 위임하기

**렌더 프롭(Render Props)**은 컴포넌트가 무엇을 렌더링할지를 직접 결정하지 않고, **함수 prop을 통해 호출자가 결정**하게 하는 패턴입니다. 로직은 컴포넌트 안에, 렌더링은 밖에서 제어합니다.

## 기본 구조

```jsx
function DataProvider({ render }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData().then(setData);
  }, []);

  return render(data); // 함수를 호출해서 렌더링
}

// 사용
<DataProvider render={(data) => <UserCard data={data} />} />
```

prop 이름을 `render`로 쓰는 대신 `children`을 함수로 넘기는 방식도 자주 씁니다.

```jsx
function DataProvider({ children }) {
  const [data, setData] = useState(null);
  // ...
  return children(data);
}

// 사용: children을 함수로 넘김
<DataProvider>
  {(data) => <UserCard data={data} />}
</DataProvider>
```

## 실전 예제: 마우스 위치 추적

마우스 위치를 추적하는 로직을 여러 컴포넌트에서 재사용하고 싶을 때를 생각해봅니다.

```jsx
function MouseTracker({ children }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  function handleMouseMove(e) {
    setPosition({ x: e.clientX, y: e.clientY });
  }

  return (
    <div onMouseMove={handleMouseMove} style={{ height: '100vh' }}>
      {children(position)} {/* 위치 데이터를 함수로 전달 */}
    </div>
  );
}

// 사용 1: 좌표 표시
<MouseTracker>
  {({ x, y }) => <p>마우스 위치: ({x}, {y})</p>}
</MouseTracker>

// 사용 2: 따라다니는 이미지
<MouseTracker>
  {({ x, y }) => (
    <img
      src="/cat.png"
      style={{ position: 'fixed', left: x, top: y }}
    />
  )}
</MouseTracker>
```

`MouseTracker`는 마우스 위치를 추적하는 로직만 가집니다. 그 데이터로 무엇을 그릴지는 사용하는 쪽에서 자유롭게 결정합니다.

## 실전 예제: 토글 상태 관리

```jsx
function Toggle({ children }) {
  const [isOn, setIsOn] = useState(false);

  const toggle = () => setIsOn(prev => !prev);

  return children({ isOn, toggle });
}

// 다양한 방식으로 재사용
<Toggle>
  {({ isOn, toggle }) => (
    <button onClick={toggle}>
      {isOn ? '켜짐' : '꺼짐'}
    </button>
  )}
</Toggle>

<Toggle>
  {({ isOn, toggle }) => (
    <Switch checked={isOn} onChange={toggle} />
  )}
</Toggle>
```

## 렌더 프롭 vs HOC

두 패턴 모두 로직 재사용이 목적이지만 방식이 다릅니다.

| | HOC | 렌더 프롭 |
|--|-----|---------|
| 로직 전달 방식 | props 주입 | 함수 인자로 전달 |
| 사용 위치 | 컴포넌트 정의 시 | JSX 안에서 |
| 동적 데이터 전달 | 제한적 | 자연스러움 |
| 가독성 | 컴포넌트 선언부가 복잡 | JSX가 중첩될 수 있음 |

```jsx
// HOC: 컴포넌트를 미리 감쌈
const TrackedComponent = withMousePosition(MyComponent);

// 렌더 프롭: JSX 안에서 바로 사용
<MouseTracker>
  {(position) => <MyComponent position={position} />}
</MouseTracker>
```

렌더 프롭은 전달할 데이터가 렌더링 시점에 결정되거나, 여러 컴포넌트를 조합해야 할 때 더 유연합니다.

## 현재의 위치

렌더 프롭도 HOC와 마찬가지로, 훅이 등장하면서 많은 경우에 커스텀 훅으로 대체할 수 있게 됐습니다.

```jsx
// 렌더 프롭 방식
<MouseTracker>
  {(position) => <Component position={position} />}
</MouseTracker>

// 커스텀 훅 방식 (더 간단)
function Component() {
  const position = useMousePosition();
  return <div>{position.x}, {position.y}</div>;
}
```

그럼에도 렌더 프롭이 유용한 경우가 있습니다.
- 서드파티 라이브러리 (예: React Router의 `<Route render={...} />`)
- 컴포넌트 경계에서 동적으로 렌더링을 바꿔야 할 때
- 같은 로직으로 완전히 다른 UI를 그려야 할 때

## 정리

- 렌더 프롭은 "무엇을 그릴지"를 함수 prop으로 위임하는 패턴입니다
- 로직과 렌더링을 깔끔하게 분리할 수 있습니다
- 새 코드에서는 커스텀 훅이 더 간결한 대안이지만, 컴포넌트 트리 안에서 렌더링을 동적으로 제어해야 할 때는 여전히 유용합니다
