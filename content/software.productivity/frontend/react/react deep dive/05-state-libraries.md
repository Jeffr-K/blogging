---
title: "JSX"
date: 2024-06-15
tags: ["engineering", "best practices", "software development"]
author: oscar.rs
---

# 상태

# React 상태의 역사: Flux Pattern

```tsx
type StoreState = {
  count: number
}

type Action = { type: "add", payload: number }

function reducer(prevState: StoreState, action: Action) {
  const { type: ActionType } = action

  if (ActionType === "add") {
    return { count: prevState.count + action.payload }
  }

  throw new Error(`Unexpected Action [${ActionType}]`)
}

export default function App() {
  const [state, dispatcher] = useReducer(reducer, { count: 0 })

  function handleClick() {
    dispatcher({ type: "add", payload: 1 });
  }

  return (
    <div>
      <h1>{state.count}</h1>
      <button onClick={handleClick}>+</button>
    </div>
  )
}
```

# React 상태의 역사: Redux

# React 상태의 역사: Context API

```tsx
class MyComponent extends React.Component {
  static childContextTypes = {
    name: PropTypes.string,
    age: PropTypes.number
  }

  getChildContext() {
    return {
      name: 'foo',
      age: 30
    }
  }

  render() {
    return <ChildComponent />
  }
}

function ChildComponent(props, context) {
  return (
    <div>
      <p>Name: {context.name}</p>
      <p>Age: {context.age}</p>
    </div>
  )
}

ChildComponent.contextTypes = {
  name: PropTypes.string,
  age: PropTypes.number
}
```

이 방식에는 몇 가지 문제점이 있었는데 첫 번째로 상위 컴포넌트가 렌더링 되면 getChildContext 도 호출됨과 동시에 shouldComponentUpdate 가 항상 true 를 반환해 불필요하게 렌더링이 일어난다는 점, getChildContext 를 사용하기 위해서는 context 를 인수로 받아야 하는데 이 때문에 컴포넌트와 결합도가 높아지는 단점이 있었다.
이러한 단점을 해결하기 위해 16.3 버전에서 새로운 context 가 출시됐다.

다음은 Context API 를 사용해 하위 컴포넌트에 상태를 전달하는 예다.

```tsx

type Counter = {

  count: number
}

const CounterContext = createContext<Counter | undefined>(undefined);

class CounterComponent extends Component {
  render() {
    return (
      <CounterContext.Consumer>
        {(state) => <p>{state?.count}</p>} // 2. 부모의 상태를 사용할 수 있다.
      </CounterContext.Consumer>
    )
  }
}

class DummyParent extends Component {
  render() {
    return (
      <>
        <CounterComponent /> // 1. props 로 상태를 내리지 않지만
      </>
    )
  }
}

class default class MyApp extends Component<{}, Counter> {
  state = { count: 0 };

  componentDidMount() {
    this.setState({ count: 1 })
  }

  handleClick = () => {
    this.setState((state) => ({ count: state.count + 1 }))
  }

  render() {
    return (
      <CountContext.Provider value={this.state}>
        <button onClick={this.handleClick}>+</button>
        <DummyParent />
      </CountContext.Provider>
    )
  }
}
```

이 코드를 보면 부모 컴포넌트인 MyApp 에 상태가 선언되어 있고 이를 Context 로 주입하고 있는 것을 볼 수 있다. 그리고 Provider 로 주입된 상태는 자식의 자식인 CounterComponent 에서 사용하고 있음을 알 수 있다.
앞서 언급한 props drilling 문제를 해결한 것이다. 하지만 Context API 는 상태 관리가 아닌 주입을 도와주는 기능이며 렌더링을 막아주는 기능 또한 존재하지 않으니 사용할 때 주의해야 한다.

# React 상태의 역사: 훅의 탄생, 그리고 React Query 와 SWR

Context API 가 선보인지 1년이 채 되지 않아 리액트는 16.8 버전에서 함수 컴포넌트에 사용하 ㄹ수 있는 다양한 훅 API 를 추가했다. 이 훅 API 는 기존에 무상태 컴포넌트를 선언하기 위해서만 제한적으로 사용됐던 함수 컴포넌트가 클래스 컴포넌트 이상의 인기를 구가할 수 있도록 많은 기능을 제공했다.

이 가운데 가장 큰 변경점 중 하나로 꼽을 수 있는 것은 State 를 매우 손쉽게 재사용 가능하도록 만들 수 있다는 것이다.

```tsx
function useCounter() {
  const [count, setCount] = useState(0);

  function increase() {
    setCount((prev) => prev + 1);
  }

  return { count, increase };
}
```

useCounter 는 단순히 count state 와 이를 1씩 올려주는 increase 로만 구성되어 있으나 내부적으로 관리하고 있는 state 도 있으며 또 이를 필요한 곳에서 재사용할 수 있게 됐다. 이는 클래스 컴포넌트보다 훨씬 간결하고 직관적인 방법이었으며 리액트 개발자들은 앞다투어 자신만의 훅을 만들어내기 시작했다.

두 라이브러리는 모두 외부에서 데이터를 불러오는 fetch 를 관리하는 데 특화된 라이브러리지만, API 호출에 대한 상태를 관리하고 있기 떄문에 HTTP 요청에 특화된 상태 관리 라이브러리라 볼 수 있다. SWR 을 사용한 코드를 살펴보자.

```tsx
import React from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function App() {
  const { data, error } = useSWR(`https://api.github.com/repos/vercel/swr`, fetcher);

  if (error) return "An error has ouccred";
  if (!data) return "Loading...";

  return (
    <div>
      <p>{JSON.stringify(data)}</p>
    </div>
  )
}
```

useSWR 의 첫번째 인수로 조회할 API 주소를 두 번째 인수로 조회에 사용되는 fetch 를 넘겨준다. 첫번쨰 인수인 API 주소는 키로도 사용되며 이후에 다른 곳에서 동일한 키로 호출하면 재조회하는 것이 아니라 useSWR 이 관리하고 있는 캐시의 값을 활용한다.

기존에 우리가 알고 있는 상태 관리 라이브러리보다는 제한적인 목적으로 일반적인 형태와는 다르다는 점만 제외하면 분명히 SWR 이나 React Query 도 상태 관리 라이브러리의 일종이라 볼 수 있다.

실제로 애플리케이션에서 이 두 라이브러리를 사용해 보면 생각보다 애플리케이션의 많은 부분에서 상태를 관리하는 코드가 사라진다는 것을 알 수 있다.

# React 상태의 역사: Recoil, Jotai, Valtio 에 이르기까지

SWR 과 React Query 가 HTTP 요청에 대해서만 쓸 수 있다면 좀 더 범용적으로 쓸 수 있는 상태 관리 라이브러리엔 어떤 변화가 있을까?

훅이라는 새로운 패러다임의 등장에 따라 훅을 활용해 상태를 가져오거나 관리할 수 있는 다양한 라이브러리가 등장하게 된다. 페이스북 팀에서 만든 Recoil 을 필두로 Jotai, Zustand, Valtio 등 다양한 라이브러리가 선보이게 된다.

```tsx
// recoil
const counter = atom({ key: 'count', default: 0 });
const todoList = useRecoilValue(counter);

// jotai
const countAtom = atom(0);
const [count, setCount] = useAtom(countAtom);

// zustand
const useCounterStore = create((set) => ({
  count: 0,
  increase = () => set((state) => ({ count: state.counter + 1 })),
}))
const count = useCounterStore((state) => state.count);

// Valtio
const state = proxy({ count: 0 });
const snap = useSnapShot(state);
state.count++;
```

# 리액트 훅으로 시작하는 상태관리

### useReducer 를 이용하여 useState 를 구현하기

useReducer 를 이용한 useState

```tsx
type Initializer<T> = T extends any ? T | ((prev: T) => T) : never;

function useStateWithUseReducer<T>(initialState: T) {
  const [state, dispatch] = useReducer(
    (prev: T, action: Initializer<T>) => typeof action === 'function' ? action(prev) : action,
    initialState
  )

  return [state, dispatch]
}
```

useState 를 이용한 useReducer

```tsx
function useReducerWithUseState(reducer, initialState, initializer) {
  const [state, setState] = useState(
    initializer ? () => initializer(initialState) : initialState
  )

  const dispatch = useCallback(
    (action) => setState((prev) => reducer(prev, action)),
    [reducer],
  )

  return [state, dispatch];
}
```
