---
title: "[React 패턴 시리즈] 4. 복합 컴포넌트 (Compound Component): 내부 상태를 공유하는 컴포넌트 패밀리"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "compound-component", "복합컴포넌트", "context"]
---

# 복합 컴포넌트 (Compound Component): 내부 상태를 공유하는 컴포넌트 패밀리

HTML의 `<select>`와 `<option>`을 생각해봅니다. 이 둘은 따로따로는 의미가 없지만, 함께 쓰면 완전한 드롭다운 메뉴가 됩니다. `<option>`은 자신이 어느 `<select>` 안에 있는지 자동으로 알고, 선택 상태도 공유합니다.

이처럼 **여러 컴포넌트가 내부 상태를 암묵적으로 공유하면서 하나의 UI를 이루는 패턴**을 복합 컴포넌트(Compound Component)라고 합니다.

## 문제: props 폭발

복잡한 UI를 단일 컴포넌트로 만들면 props가 폭발합니다.

```jsx
// 이렇게 하면 안 됩니다
<Select
  options={options}
  placeholder="선택하세요"
  isMulti={false}
  isSearchable={true}
  renderOption={(option) => <span>{option.label}</span>}
  renderSelectedValue={(value) => <strong>{value.label}</strong>}
  onOpen={() => {}}
  onClose={() => {}}
/>
```

props가 많아질수록 API가 복잡해지고, 컴포넌트 내부 로직도 조건분기로 가득 찹니다.

## 복합 컴포넌트로 해결

```jsx
<Select>
  <Select.Trigger>선택하세요</Select.Trigger>
  <Select.Options>
    <Select.Option value="kr">한국어</Select.Option>
    <Select.Option value="en">English</Select.Option>
    <Select.Option value="ja">日本語</Select.Option>
  </Select.Options>
</Select>
```

사용하는 쪽의 코드가 훨씬 읽기 쉽고, 각 부분을 자유롭게 커스터마이징할 수 있습니다.

## 구현: Context로 내부 상태 공유

`Select.Option`이 부모 `Select`의 선택 상태를 알려면, Context를 사용합니다.

```jsx
import { createContext, useContext, useState } from 'react';

const SelectContext = createContext(null);

function Select({ children }) {
  const [selectedValue, setSelectedValue] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ selectedValue, setSelectedValue, isOpen, setIsOpen }}>
      <div className="select-container">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

Select.Trigger = function Trigger({ children }) {
  const { selectedValue, isOpen, setIsOpen } = useContext(SelectContext);

  return (
    <button onClick={() => setIsOpen(prev => !prev)}>
      {selectedValue ?? children}
      <span>{isOpen ? '▲' : '▼'}</span>
    </button>
  );
};

Select.Options = function Options({ children }) {
  const { isOpen } = useContext(SelectContext);

  if (!isOpen) return null;

  return (
    <ul className="select-options">
      {children}
    </ul>
  );
};

Select.Option = function Option({ value, children }) {
  const { selectedValue, setSelectedValue, setIsOpen } = useContext(SelectContext);
  const isSelected = selectedValue === value;

  function handleClick() {
    setSelectedValue(value);
    setIsOpen(false);
  }

  return (
    <li
      onClick={handleClick}
      className={isSelected ? 'selected' : ''}
    >
      {children}
    </li>
  );
};
```

각 서브컴포넌트는 Context를 통해 부모의 상태를 직접 읽고 쓸 수 있습니다. 사용하는 쪽은 이 연결을 신경 쓸 필요가 없습니다.

## 또 다른 예제: Tabs

```jsx
<Tabs defaultTab="profile">
  <Tabs.List>
    <Tabs.Tab value="profile">프로필</Tabs.Tab>
    <Tabs.Tab value="settings">설정</Tabs.Tab>
    <Tabs.Tab value="notifications">알림</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="profile">
    <ProfileContent />
  </Tabs.Panel>
  <Tabs.Panel value="settings">
    <SettingsContent />
  </Tabs.Panel>
  <Tabs.Panel value="notifications">
    <NotificationsContent />
  </Tabs.Panel>
</Tabs>
```

탭의 활성 상태는 `Tabs` 내부에서 관리되고, `Tabs.Tab`과 `Tabs.Panel`은 Context를 통해 활성 탭이 무엇인지 압니다.

## 장단점

**장점**
- 사용 API가 선언적이고 읽기 쉽습니다
- 내부 구현이 외부로 노출되지 않습니다
- 서브컴포넌트를 원하는 순서와 위치에 자유롭게 배치할 수 있습니다
- props 폭발 없이 유연한 커스터마이징이 가능합니다

**단점**
- 구현이 단순 컴포넌트보다 복잡합니다
- 서브컴포넌트를 `Select` 외부에서 사용하면 Context가 없어 오류가 생깁니다

```jsx
// 잘못된 사용: Select 밖에서 Option 단독 사용
<Select.Option value="kr">한국어</Select.Option> // Context 없음, 오류!
```

Context가 없을 때 경고를 주는 방어 코드를 추가할 수 있습니다.

```jsx
function useSelectContext() {
  const ctx = useContext(SelectContext);
  if (!ctx) {
    throw new Error('Select 컴포넌트 안에서 사용해야 합니다.');
  }
  return ctx;
}
```

## 정리

- 복합 컴포넌트는 Context를 통해 내부 상태를 서브컴포넌트들과 공유합니다
- 사용하는 쪽의 코드가 HTML처럼 선언적이고 읽기 쉬워집니다
- `Select/Option`, `Tabs/Tab/Panel`, `Accordion/Item` 같은 연관된 UI 묶음에 적합합니다
- 많은 UI 라이브러리(Radix UI, Headless UI 등)가 이 패턴을 사용합니다
