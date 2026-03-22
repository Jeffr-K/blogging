---
title: "[React 패턴 시리즈] 11. Headless Component: 로직과 UI의 완전한 분리"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "headless", "재사용", "접근성"]
---

# Headless Component: 로직과 UI의 완전한 분리

**Headless Component**는 로직과 상태 관리는 제공하지만, **UI는 전혀 렌더링하지 않는** 컴포넌트(또는 훅)입니다. "머리(head, 즉 시각적 표현)가 없다"는 뜻입니다.

Radix UI, Headless UI, React Aria 같은 라이브러리들이 이 패턴을 사용합니다. 복잡한 접근성(a11y) 로직과 상태 관리는 라이브러리가 담당하고, 스타일링은 개발자가 완전히 자유롭게 합니다.

## 기존 방식의 문제

스타일이 내장된 컴포넌트 라이브러리를 쓰면, 디자인을 바꾸기 어렵습니다.

```jsx
// 스타일이 내장된 라이브러리
import { Modal } from 'some-ui-library';

// 클래스 이름으로만 오버라이드 가능, 한계가 있음
<Modal className="my-modal"> ... </Modal>
```

디자인을 완전히 바꾸려면 라이브러리를 교체해야 합니다.

## Headless 방식

```jsx
// Radix UI (Headless): 스타일 없음, 로직만 제공
import * as Dialog from '@radix-ui/react-dialog';

function MyModal({ isOpen, onClose, children }) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="my-overlay" /> {/* 내 스타일 적용 */}
        <Dialog.Content className="my-modal">   {/* 내 스타일 적용 */}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

키보드 네비게이션, 포커스 트랩, 접근성 속성(`aria-*`) 등은 Radix가 처리하고, 시각적 표현은 100% 개발자가 결정합니다.

## 직접 만들기: Headless 훅 패턴

커스텀 훅으로 Headless 패턴을 구현할 수 있습니다.

```jsx
// useDropdown.js: 드롭다운 로직만, UI 없음
function useDropdown(items) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 키보드 네비게이션
  function handleKeyDown(e) {
    if (!isOpen) return;
    switch (e.key) {
      case 'ArrowDown':
        setHighlightedIndex(i => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        setSelectedItem(items[highlightedIndex]);
        setIsOpen(false);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }

  // prop getter: 필요한 속성들을 한 번에 제공
  function getToggleProps() {
    return {
      onClick: () => setIsOpen(prev => !prev),
      onKeyDown: handleKeyDown,
      'aria-expanded': isOpen,
      'aria-haspopup': 'listbox',
    };
  }

  function getItemProps(index) {
    return {
      onClick: () => {
        setSelectedItem(items[index]);
        setIsOpen(false);
      },
      'aria-selected': selectedItem === items[index],
      role: 'option',
    };
  }

  return {
    isOpen,
    selectedItem,
    highlightedIndex,
    containerRef,
    getToggleProps,
    getItemProps,
  };
}
```

```jsx
// 사용 1: 기본 드롭다운
function BasicDropdown({ items }) {
  const { isOpen, selectedItem, highlightedIndex, containerRef, getToggleProps, getItemProps } =
    useDropdown(items);

  return (
    <div ref={containerRef}>
      <button {...getToggleProps()}>
        {selectedItem ?? '선택하세요'} ▼
      </button>
      {isOpen && (
        <ul role="listbox">
          {items.map((item, i) => (
            <li
              key={item}
              style={{ background: highlightedIndex === i ? '#eee' : '' }}
              {...getItemProps(i)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 사용 2: 완전히 다른 스타일의 드롭다운 (같은 훅 재사용)
function FancyDropdown({ items }) {
  const { isOpen, selectedItem, getToggleProps, getItemProps } =
    useDropdown(items);

  return (
    <div className="fancy-select">
      <div className="fancy-trigger" {...getToggleProps()}>
        <span>{selectedItem ?? '항목 선택'}</span>
        <ChevronIcon />
      </div>
      {isOpen && (
        <div className="fancy-options">
          {items.map((item, i) => (
            <div className="fancy-option" key={item} {...getItemProps(i)}>
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

같은 `useDropdown` 훅으로 완전히 다른 두 가지 UI를 만들었습니다.

## 언제 적합한가?

| 상황 | 권장 |
|------|------|
| 특정 디자인에 묶이고 싶지 않을 때 | Headless |
| 복잡한 접근성 로직이 필요할 때 | Headless |
| 빠른 프로토타이핑, 일관된 디자인 | 스타일 내장 라이브러리 |
| 디자인 커스터마이징이 거의 없을 때 | 스타일 내장 라이브러리 |

## 정리

- Headless Component는 상태와 로직만 제공하고 렌더링하지 않습니다
- 같은 로직으로 완전히 다른 UI를 만들 수 있습니다
- 접근성 구현을 라이브러리에 위임하면서 디자인 자유도를 얻습니다
- 커스텀 훅 형태로 직접 구현하거나, Radix UI / Headless UI 같은 라이브러리를 사용합니다
