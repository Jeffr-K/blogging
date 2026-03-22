---
title: "[React 패턴 시리즈] 5. 제어의 역전 (Inversion of Control): 유연한 컴포넌트 설계"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "inversion-of-control", "제어의역전", "유연성"]
---

# 제어의 역전 (Inversion of Control): 유연한 컴포넌트 설계

**제어의 역전(Inversion of Control, IoC)**은 "컴포넌트가 모든 것을 스스로 결정하지 말고, 사용하는 쪽에 결정권을 넘겨라"는 원칙입니다. 라이브러리나 공통 컴포넌트를 만들 때 특히 중요합니다.

## 문제: 지나치게 결정하는 컴포넌트

버튼 클릭 횟수를 표시하는 컴포넌트를 만든다고 가정합니다.

```jsx
// 버전 1: 모든 것을 스스로 결정
function CounterButton() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(prev => prev + 1)}>
      클릭 수: {count}
    </button>
  );
}
```

그런데 요구사항이 생깁니다.
- "최대 10번만 클릭 가능하게 해주세요"
- "클릭할 때 API도 호출해야 해요"
- "카운트를 다른 컴포넌트와 공유해야 해요"

이 요구사항들을 모두 `CounterButton` 안에 넣으면 컴포넌트가 점점 비대해집니다.

```jsx
// 버전 2: 특수 케이스들이 쌓인 컴포넌트
function CounterButton({ max, onCountChange, onApiCall, sharedCount }) {
  const [localCount, setLocalCount] = useState(0);
  const count = sharedCount ?? localCount;

  function handleClick() {
    if (max && count >= max) return;
    const next = count + 1;
    setLocalCount(next);
    onCountChange?.(next);
    onApiCall?.();
  }

  return <button onClick={handleClick}>클릭 수: {count}</button>;
}
```

props가 늘어날수록 내부 로직도 복잡해집니다.

## 제어를 역전시키기

대신 컴포넌트가 핵심 기능만 제공하고, 동작을 사용하는 쪽에서 제어하게 합니다.

```jsx
// 제어를 역전: 상태와 핸들러를 밖에서 받음
function CounterButton({ count, onClick }) {
  return (
    <button onClick={onClick}>
      클릭 수: {count}
    </button>
  );
}

// 사용하는 쪽에서 모든 것을 결정
function App() {
  const [count, setCount] = useState(0);

  function handleClick() {
    if (count >= 10) return; // 최대값 로직
    setCount(prev => prev + 1);
    callApi(); // API 호출
  }

  return <CounterButton count={count} onClick={handleClick} />;
}
```

`CounterButton`은 이제 단순히 "숫자와 클릭 핸들러를 받아 렌더링하는" 역할만 합니다. 비즈니스 로직은 사용하는 쪽에 있습니다.

## 제어 컴포넌트 패턴 (Controlled Component)

폼 입력에서 가장 많이 볼 수 있는 IoC 패턴입니다.

```jsx
// 비제어 컴포넌트: 자신의 상태를 스스로 관리
function UncontrolledInput() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={e => setValue(e.target.value)} />;
}

// 제어 컴포넌트: 값과 변경 핸들러를 밖에서 받음
function ControlledInput({ value, onChange }) {
  return <input value={value} onChange={onChange} />;
}

// 사용하는 쪽에서 제어
function Form() {
  const [name, setName] = useState('');
  return (
    <ControlledInput
      value={name}
      onChange={e => setName(e.target.value)}
    />
  );
}
```

제어 컴포넌트는 부모가 항상 최신 값을 알고 있으므로, 검증, 형식 변환 등을 부모에서 자유롭게 처리할 수 있습니다.

## State Reducer 패턴

더 진화된 IoC 패턴입니다. 컴포넌트가 기본 동작을 제공하되, 사용자가 reducer를 오버라이드해서 동작을 바꿀 수 있게 합니다.

```jsx
function useToggle({ reducer = (state, action) => action.changes } = {}) {
  const [state, dispatch] = useReducer(
    (currentState, action) => {
      const changes = toggleReducer(currentState, action); // 기본 로직
      return reducer(currentState, { ...action, changes }); // 오버라이드 가능
    },
    { isOn: false }
  );

  const toggle = () => dispatch({ type: 'TOGGLE', changes: { isOn: !state.isOn } });

  return { isOn: state.isOn, toggle };
}

// 기본 사용
const { isOn, toggle } = useToggle();

// 최대 5번만 토글 가능하도록 제어 역전
let clickCount = 0;
const { isOn, toggle } = useToggle({
  reducer(state, action) {
    if (action.type === 'TOGGLE' && clickCount >= 5) {
      return state; // 기본 동작을 막음
    }
    clickCount++;
    return action.changes; // 기본 동작 허용
  }
});
```

## Prop Getter 패턴

접근성 속성이나 이벤트 핸들러 등을 한 번에 묶어서 넘겨주는 패턴입니다.

```jsx
function useToggle() {
  const [isOn, setIsOn] = useState(false);

  function getToggleProps(extraProps = {}) {
    return {
      'aria-pressed': isOn,
      onClick: () => setIsOn(prev => !prev),
      ...extraProps, // 추가 props도 병합
    };
  }

  return { isOn, getToggleProps };
}

// 사용
function App() {
  const { isOn, getToggleProps } = useToggle();

  return (
    <button {...getToggleProps({ className: 'my-button' })}>
      {isOn ? 'ON' : 'OFF'}
    </button>
  );
}
```

## 정리

제어의 역전은 "컴포넌트를 얼마나 유연하게 만들 것인가"의 문제입니다.

| 컴포넌트 제어 수준 | 특징 |
|-----------------|------|
| 높음 (비제어) | 사용하기 쉽지만 커스터마이징 어려움 |
| 낮음 (제어) | 사용하기 복잡하지만 완전한 제어 가능 |

범용으로 쓰이는 컴포넌트일수록 제어를 사용하는 쪽에 더 많이 위임하세요. 단, 너무 많은 것을 외부에 위임하면 사용하기 불편해지므로 적절한 균형이 중요합니다.
