---
title: "[React 패턴 시리즈] 7. Portal: DOM 트리 바깥에 렌더링하기"
author: oscar.rs
date: 2026-03-22
tags: ["react", "patterns", "portal", "modal", "createPortal"]
---

# Portal: DOM 트리 바깥에 렌더링하기

React 컴포넌트는 기본적으로 부모 컴포넌트의 DOM 노드 안에 렌더링됩니다. 하지만 모달, 툴팁, 드롭다운 같은 UI는 **부모의 스타일 제약(overflow: hidden, z-index 등)에서 벗어나** 페이지 최상단에 렌더링해야 할 때가 많습니다. 이것이 Portal의 역할입니다.

## 문제: overflow와 z-index 지옥

```jsx
function Card() {
  return (
    <div style={{ overflow: 'hidden', position: 'relative' }}>
      <Tooltip /> {/* overflow: hidden 때문에 잘림! */}
    </div>
  );
}
```

부모에 `overflow: hidden`이 있으면 자식 툴팁이 잘립니다. `z-index`를 아무리 높여도 부모의 stacking context를 벗어날 수 없습니다.

## createPortal

`ReactDOM.createPortal(children, container)`은 `children`을 React 트리가 아닌 **지정한 DOM 노드** 안에 렌더링합니다.

```jsx
import { createPortal } from 'react-dom';

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body // body 바로 아래에 렌더링
  );
}
```

```html
<!-- HTML 구조 -->
<div id="root">
  <div class="app">
    <!-- Modal은 여기 없음 -->
  </div>
</div>

<!-- Portal로 렌더링된 Modal은 여기에 -->
<div class="modal-overlay">
  <div class="modal-content">...</div>
</div>
```

DOM 위치는 `body` 아래지만, **React 이벤트 버블링은 React 트리를 따릅니다.** Portal 안에서 발생한 이벤트는 DOM 부모가 아니라 React 부모 컴포넌트로 버블링됩니다.

## 실전 예제: 재사용 가능한 Modal

```jsx
// Modal.jsx
function Modal({ isOpen, onClose, title, children }) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// 사용
function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(true)}>모달 열기</button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="안내">
        <p>모달 내용입니다.</p>
      </Modal>
    </div>
  );
}
```

## Tooltip 예제

```jsx
function Tooltip({ children, text }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  function handleMouseEnter() {
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.top - 36 + window.scrollY,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
    setVisible(true);
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </span>
      {visible && createPortal(
        <div
          className="tooltip"
          style={{ position: 'absolute', top: position.top, left: position.left }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}
```

어느 깊이에서 사용해도 부모의 `overflow`나 `z-index` 영향을 받지 않습니다.

## 정리

- `createPortal(JSX, DOM노드)`로 React 트리 밖 DOM에 렌더링합니다
- DOM 위치는 바뀌지만 React 이벤트 버블링은 React 트리를 따릅니다
- 모달, 툴팁, 드롭다운, 토스트 알림에 사용합니다
- `overflow: hidden`이나 `z-index` 문제를 근본적으로 해결합니다
