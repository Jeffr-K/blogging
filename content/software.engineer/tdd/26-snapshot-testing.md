---
title: "[TDD 시리즈] 26. 스냅샷 테스트 — 출력 변화를 자동으로 감지하기"
author: oscar.rs
date: 2026-04-03
tags: ["TDD", "스냅샷 테스트", "Jest", "Approval Testing", "React"]
---

# 스냅샷 테스트 — 출력 변화를 자동으로 감지하기

스냅샷 테스트는 단순한 아이디어다. 코드의 출력을 파일로 저장해두고, 이후 실행에서 출력이 달라지면 알려준다. 의도적인 변경인지 실수인지는 개발자가 판단한다.

이 단순함이 스냅샷 테스트의 강점이자 약점이다. 설정이 거의 필요 없고 빠르게 추가할 수 있지만, 무분별하게 사용하면 테스트 스위트가 노이즈로 가득 차게 된다.

## 스냅샷 테스트가 적합한 경우

**UI 컴포넌트**: React 컴포넌트의 렌더링 결과. 컴포넌트가 특정 props를 받아 특정 HTML 구조를 생성하는지 추적한다. 의도치 않은 마크업 변경을 잡는다.

**JSON API 응답**: API 응답의 구조와 필드 목록이 바뀌지 않았는지 확인한다. 백엔드 변경이 API 계약을 깨지 않도록.

**복잡한 객체 출력**: 직렬화 결과, 컴파일러/변환기 출력, 설정 파일 생성 결과처럼 사람이 매번 직접 검증하기 번거로운 복잡한 출력.

**부적합한 경우**: 비즈니스 로직 검증에는 스냅샷 테스트가 맞지 않는다. "할인율이 올바르게 적용됐는가"는 스냅샷이 아니라 명시적인 assert로 검증해야 한다. 스냅샷은 **"무언가가 변했다"**는 것을 알려주지, **"왜 틀렸는가"**를 설명하지 않는다.

## Jest 스냅샷 테스트 — React 컴포넌트

```tsx
// Button.tsx
interface ButtonProps {
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

export function Button({ label, variant, disabled = false }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={disabled}
      data-testid="button"
    >
      {label}
    </button>
  );
}
```

```tsx
// Button.test.tsx
import { render } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('primary 버튼을 렌더링한다', () => {
    const { container } = render(<Button label="저장" variant="primary" />);
    expect(container).toMatchSnapshot();
  });

  it('disabled 상태를 렌더링한다', () => {
    const { container } = render(
      <Button label="제출" variant="primary" disabled />
    );
    expect(container).toMatchSnapshot();
  });
});
```

처음 실행하면 `__snapshots__/Button.test.tsx.snap` 파일이 생성된다:

```
// Jest Snapshot v1, https://goo.gl/fbAQLP

exports[`Button primary 버튼을 렌더링한다 1`] = `
<div>
  <button
    class="btn btn-primary"
    data-testid="button"
  >
    저장
  </button>
</div>
`;

exports[`Button disabled 상태를 렌더링한다 1`] = `
<div>
  <button
    class="btn btn-primary"
    data-testid="button"
    disabled=""
  >
    제출
  </button>
</div>
`;
```

이후 실행에서 컴포넌트 출력이 달라지면 테스트가 실패한다.

## 인라인 스냅샷

외부 파일 대신 테스트 코드 안에 스냅샷을 인라인으로 넣을 수 있다.

```tsx
it('에러 메시지를 렌더링한다', () => {
  const { container } = render(
    <ErrorMessage message="입력값이 올바르지 않습니다" />
  );
  expect(container).toMatchInlineSnapshot(`
    <div>
      <p
        class="error-message"
        role="alert"
      >
        입력값이 올바르지 않습니다
      </p>
    </div>
  `);
});
```

인라인 스냅샷은 코드 리뷰 시 변경 내용을 바로 볼 수 있다는 장점이 있다. 스냅샷 파일을 따로 열 필요가 없다. 단, 스냅샷이 크면 테스트 코드가 읽기 어려워진다. 작은 컴포넌트에만 적합하다.

## 스냅샷 업데이트 규칙

스냅샷 테스트가 실패했을 때 두 가지 가능성이 있다.

**의도적 변경**: 컴포넌트를 수정했고 출력이 달라지는 게 맞다. 스냅샷을 업데이트한다.

```bash
npx jest --updateSnapshot
# 또는
npx jest -u
```

**의도치 않은 변경**: 버그나 실수로 출력이 달라졌다. 코드를 수정한다.

문제는 팀 내에서 "일단 업데이트하고 보자" 문화가 생길 때다. 스냅샷 업데이트를 너무 쉽게 하면 실제 회귀 버그를 놓친다. **스냅샷 업데이트는 반드시 변경 이유를 이해한 뒤에 해야 한다.** PR에서 스냅샷 파일 변경이 포함되면 리뷰어가 내용을 확인하는 것이 원칙이다.

## 스냅샷 파일 관리

스냅샷 파일은 반드시 버전 관리에 포함한다. 스냅샷 파일 없이 테스트를 실행하면 새로 생성되므로 실패하지 않는다. 버전 관리에 없으면 CI에서 항상 새로 생성되어 스냅샷의 의미가 없어진다.

스냅샷 크기 관리도 중요하다. 너무 큰 스냅샷은 변경 diff가 의미 없어진다. 전체 페이지를 스냅샷으로 찍는 대신 관심 있는 부분 컴포넌트만 찍는다.

오래된 스냅샷은 정기적으로 정리한다:

```bash
npx jest --ci  # CI 모드: 새 스냅샷 생성 금지
npx jest --detectOpenHandles --forceExit  # 사용되지 않는 스냅샷 경고
```

## "스냅샷 테스트는 TDD가 아니다"

명확히 해두자. **스냅샷 테스트는 TDD와 어울리지 않는다.**

TDD는 Red-Green-Refactor 사이클을 통해 설계를 이끈다. 테스트를 먼저 쓰면서 "이 코드가 어떻게 사용돼야 하는가"를 고민한다. 스냅샷 테스트는 반대다. 먼저 코드를 만들고, 그 출력을 저장한다. 설계에 대한 피드백을 전혀 주지 않는다.

스냅샷 테스트는 **회귀 방지 도구**다. 이미 동작하는 코드가 앞으로도 같은 방식으로 동작하는지 지켜보는 것. 설계 도구가 아니다.

## Approval Testing — 레거시 코드에 적용하기

Approval Testing(Golden Master Testing)은 스냅샷 테스트의 개념을 레거시 코드에 적용하는 기법이다. 테스트가 없는 레거시 코드를 리팩토링할 때 유용하다.

아이디어: 현재 동작을 "정답(Golden Master)"으로 기록해두고, 리팩토링 후에도 같은 출력이 나오는지 확인한다. 현재 동작이 올바른지는 중요하지 않다. **리팩토링 전후의 동작이 동일한지**만 검증한다.

```typescript
// 레거시 코드의 현재 출력을 캡처
import { approvals } from 'approvals';
import { legacyPriceCalculator } from './legacy/priceCalculator';

describe('PriceCalculator (Legacy)', () => {
  it('다양한 상품에 대한 가격을 계산한다', () => {
    const inputs = [
      { productId: 'A001', quantity: 1, memberLevel: 'gold' },
      { productId: 'B002', quantity: 5, memberLevel: 'silver' },
      { productId: 'C003', quantity: 10, memberLevel: 'regular' },
    ];

    const results = inputs.map((input) => legacyPriceCalculator(input));
    approvals.verify(JSON.stringify(results, null, 2));
  });
});
```

처음 실행 시 현재 출력이 `.approved.txt` 파일로 저장된다. 이후 리팩토링 과정에서 출력이 달라지면 즉시 감지한다.

Approval Testing은 레거시 코드에 안전망을 씌우는 첫 번째 단계다. 이 안전망 위에서 점진적으로 단위 테스트를 추가하고, 설계를 개선해 나간다.

## 스냅샷 테스트의 자리

스냅샷 테스트는 강력한 도구지만 과용하면 독이 된다. 스냅샷이 너무 많으면 테스트 실패가 노이즈가 되고, 팀은 실패를 무시하거나 습관적으로 업데이트하게 된다.

올바른 자리가 있다. UI 컴포넌트의 구조 변화 감지, 복잡한 직렬화 출력 추적, 레거시 코드 안전망. 이 범위 안에서 절제해서 사용할 때 스냅샷 테스트는 제 역할을 한다.
