---
title: "[React 성능 최적화] 6. Key prop: 리스트 최적화와 흔한 실수"
author: oscar.rs
date: 2026-03-22
tags: ["react", "optimization", "key", "리스트", "reconciliation"]
---

# Key prop: 리스트 최적화와 흔한 실수

`key`는 리스트를 렌더링할 때 쓰는 작은 속성이지만, React의 조정(reconciliation) 알고리즘에 깊이 관련되어 있습니다. 잘못 쓰면 성능 저하와 예상치 못한 버그가 생깁니다.

## key가 없으면 무슨 일이 생기나

React는 리스트가 변경됐을 때 어떤 항목이 추가/삭제/이동됐는지 알아야 합니다. `key`가 없으면 **위치(인덱스)로만** 비교합니다.

```jsx
// key 없이 목록 앞에 항목 추가
// 변경 전: ['B', 'C', 'D']
// 변경 후: ['A', 'B', 'C', 'D']

// React의 판단 (위치 기반):
// 위치 0: 'B' → 'A' (다름, 업데이트)
// 위치 1: 'C' → 'B' (다름, 업데이트)
// 위치 2: 'D' → 'C' (다름, 업데이트)
// 위치 3: 없음 → 'D' (새로 추가)
// 결과: 모든 항목을 DOM 업데이트!
```

`key`가 있으면:

```jsx
// key로 항목의 신원을 추적
// 위치 0: key='a' 새로 추가
// 위치 1: key='b' 그대로 (이동만)
// 위치 2: key='c' 그대로 (이동만)
// 위치 3: key='d' 그대로 (이동만)
// 결과: 'A'만 추가!
```

## 올바른 key 사용

```jsx
// 데이터에 고유 ID가 있으면 그것을 사용
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.title}</li>  // DB의 고유 ID
      ))}
    </ul>
  );
}
```

## 흔한 실수 1: 인덱스를 key로 사용

```jsx
// 나쁜 예: 인덱스를 key로 사용
{todos.map((todo, index) => (
  <li key={index}>{todo.title}</li>
))}
```

목록이 **재정렬되거나 중간에 항목이 추가/삭제**될 때 인덱스 key는 잘못된 결과를 냅니다.

```
변경 전:
  key=0: '우유 사기'
  key=1: '운동하기'
  key=2: '독서하기'

'우유 사기' 삭제 후:
  key=0: '운동하기'  ← React는 key=0 항목이 '우유 사기'→'운동하기'로 수정됐다고 봄
  key=1: '독서하기'  ← key=1 항목이 '운동하기'→'독서하기'로 수정됐다고 봄
  key=2: 삭제       ← '독서하기'가 삭제됐다고 봄
```

항목이 폼 입력이나 애니메이션 상태를 가지고 있다면 이 잘못된 매핑으로 인해 상태가 엉뚱한 항목에 붙게 됩니다.

**인덱스 key가 괜찮은 경우**:
- 목록이 절대 재정렬되지 않고
- 항목이 중간에 추가/삭제되지 않고
- 항목에 상태가 없을 때

```jsx
// 이 경우엔 인덱스가 괜찮음: 순서가 고정된 탭
{tabs.map((tab, i) => (
  <Tab key={i} label={tab.label} />
))}
```

## 흔한 실수 2: 랜덤 key 사용

```jsx
// 매우 나쁜 예: 매 렌더링마다 새 key 생성
{todos.map(todo => (
  <li key={Math.random()}>{todo.title}</li>
))}
```

매 렌더링마다 모든 항목의 key가 바뀌므로, React는 이전 항목을 모두 언마운트하고 새로 마운트합니다. 캐싱, 애니메이션, 포커스 상태가 모두 날아갑니다.

## key를 활용한 state 초기화 트릭

key가 바뀌면 React는 해당 컴포넌트를 언마운트하고 새로 마운트합니다. 이것을 **의도적으로** 활용해 state를 초기화할 수 있습니다.

```jsx
function ProfilePage({ userId }) {
  // userId가 바뀌면 UserProfile을 완전히 새로 마운트
  // → UserProfile 내부 상태(폼 입력 등)가 초기화됨
  return <UserProfile key={userId} />;
}
```

```jsx
// 폼 초기화
function EditForm({ itemId }) {
  return <Form key={itemId} initialData={getItem(itemId)} />;
}
// itemId가 바뀌면 Form이 새로 마운트 → 이전 입력값 초기화
```

`key`로 리마운트를 트리거하는 것이 `useEffect`에서 복잡한 초기화 로직을 작성하는 것보다 깔끔할 때가 많습니다.

## 중첩 리스트의 key

중첩된 리스트도 각 수준에서 고유한 key가 필요합니다.

```jsx
function CategoryList({ categories }) {
  return categories.map(category => (
    <div key={category.id}>
      <h2>{category.name}</h2>
      <ul>
        {category.items.map(item => (
          <li key={item.id}>{item.name}</li>  // 각 수준에서 고유해야 함
        ))}
      </ul>
    </div>
  ));
}
```

`key`는 형제 요소들 사이에서만 고유하면 됩니다. 다른 카테고리에 같은 item.id가 있어도 괜찮습니다.

## 정리

| 상황 | 권장 key |
|------|---------|
| 데이터에 고유 ID가 있을 때 | ID 사용 |
| 순서가 고정되고 상태 없는 정적 목록 | 인덱스 허용 |
| 재정렬/삽입/삭제가 있는 목록 | 반드시 고유 ID |
| state 초기화가 필요할 때 | 의도적으로 key 변경 |
| 절대 사용 금지 | `Math.random()` 등 매번 바뀌는 값 |

`key`는 단순한 경고 해결용 속성이 아닙니다. React가 컴포넌트의 **신원**을 추적하는 핵심 수단입니다.
