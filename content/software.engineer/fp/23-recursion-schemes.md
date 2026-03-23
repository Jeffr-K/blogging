---
title: "[FP 시리즈] 23. 재귀 스킴 (Recursion Schemes)"
author: oscar.rs
date: 2026-03-23
tags: ["함수형프로그래밍", "재귀스킴", "catamorphism", "fold", "recursion schemes", "FP"]
---

# 재귀 스킴 (Recursion Schemes)

재귀 스킴은 **재귀 구조를 다루는 패턴을 추상화**합니다. 재귀적인 데이터를 처리할 때 항상 반복되는 패턴(접기, 펼치기, 변환 등)을 체계적으로 분류합니다.

## 왜 재귀 스킴인가

트리나 리스트를 처리할 때 재귀 코드는 종종 같은 구조를 반복합니다.

```typescript
// 트리에서 값을 모두 더하기
function sumTree(tree: Tree<number>): number {
  if (tree.kind === 'leaf') return tree.value;
  return sumTree(tree.left) + tree.value + sumTree(tree.right); // 재귀
}

// 트리의 모든 값을 2배로
function doubleTree(tree: Tree<number>): Tree<number> {
  if (tree.kind === 'leaf') return { ...tree, value: tree.value * 2 };
  return {
    ...tree,
    value: tree.value * 2,
    left: doubleTree(tree.left),   // 재귀
    right: doubleTree(tree.right), // 재귀
  };
}
```

두 함수는 **재귀 구조가 동일하고 "무엇을 할지"만 다릅니다**. 재귀 스킴은 이 반복을 추상화합니다.

## Catamorphism (카타모피즘) — 접기

가장 기본적인 재귀 스킴입니다. 재귀 구조를 **아래에서 위로** 접어 하나의 값으로 만듭니다. `fold`의 일반화입니다.

```typescript
type Tree<A> =
  | { kind: 'leaf'; value: A }
  | { kind: 'node'; value: A; left: Tree<A>; right: Tree<A> };

// 트리를 위한 대수(Algebra) 타입
type TreeAlgebra<A, B> = {
  leaf: (value: A) => B;
  node: (value: A, left: B, right: B) => B;
};

// cata: 대수를 받아 트리를 접음
function cata<A, B>(algebra: TreeAlgebra<A, B>, tree: Tree<A>): B {
  if (tree.kind === 'leaf') {
    return algebra.leaf(tree.value);
  }
  return algebra.node(
    tree.value,
    cata(algebra, tree.left),  // 재귀는 cata 안에 숨겨짐
    cata(algebra, tree.right),
  );
}
```

이제 재귀를 직접 쓰지 않고 `cata`에 대수만 전달합니다.

```typescript
const tree: Tree<number> = {
  kind: 'node', value: 1,
  left: { kind: 'node', value: 2,
    left: { kind: 'leaf', value: 4 },
    right: { kind: 'leaf', value: 5 },
  },
  right: { kind: 'leaf', value: 3 },
};

// 합산
const sumAlgebra: TreeAlgebra<number, number> = {
  leaf: value => value,
  node: (value, left, right) => value + left + right,
};

cata(sumAlgebra, tree); // 1+2+3+4+5 = 15

// 깊이
const depthAlgebra: TreeAlgebra<number, number> = {
  leaf: () => 0,
  node: (_, left, right) => 1 + Math.max(left, right),
};

cata(depthAlgebra, tree); // 2

// 문자열로 변환
const showAlgebra: TreeAlgebra<number, string> = {
  leaf: value => `${value}`,
  node: (value, left, right) => `(${left} ${value} ${right})`,
};

cata(showAlgebra, tree); // "((4 2 5) 1 3)"
```

재귀 로직은 `cata` 한 곳에만 있고, 각 케이스의 처리는 대수로 표현됩니다.

## 리스트의 Catamorphism = fold

배열의 `reduce`가 바로 catamorphism입니다.

```typescript
// 리스트 대수
type ListAlgebra<A, B> = {
  nil: () => B;
  cons: (head: A, tail: B) => B;
};

function cataList<A, B>(algebra: ListAlgebra<A, B>, list: A[]): B {
  if (list.length === 0) return algebra.nil();
  return algebra.cons(list[0], cataList(algebra, list.slice(1)));
}

cataList({ nil: () => 0, cons: (head, tail) => head + tail }, [1, 2, 3, 4, 5]);
// 15 — 이것이 reduce(sum, 0)과 같음
```

## Anamorphism (아나모피즘) — 펼치기

catamorphism의 반대입니다. 씨앗 값에서 **재귀 구조를 생성**합니다. `unfold`입니다.

```typescript
// 씨앗(seed)에서 트리를 만드는 코알지브라(Coalgebra)
type TreeCoalgebra<A, S> = {
  isLeaf: (seed: S) => boolean;
  value: (seed: S) => A;
  left: (seed: S) => S;
  right: (seed: S) => S;
};

function ana<A, S>(coalgebra: TreeCoalgebra<A, S>, seed: S): Tree<A> {
  if (coalgebra.isLeaf(seed)) {
    return { kind: 'leaf', value: coalgebra.value(seed) };
  }
  return {
    kind: 'node',
    value: coalgebra.value(seed),
    left: ana(coalgebra, coalgebra.left(seed)),
    right: ana(coalgebra, coalgebra.right(seed)),
  };
}

// 숫자에서 이진 트리 생성
const binaryTreeCoalgebra: TreeCoalgebra<number, number> = {
  isLeaf: n => n <= 0,
  value: n => n,
  left: n => n - 1,
  right: n => n - 2,
};

ana(binaryTreeCoalgebra, 3);
// {kind:'node', value:3, left:{...2...}, right:{...1...}}
```

배열의 `unfold` (Generator로 구현 가능):

```typescript
function unfold<A, S>(fn: (seed: S) => [A, S] | null, seed: S): A[] {
  const result: A[] = [];
  let current = seed;
  while (true) {
    const next = fn(current);
    if (next === null) break;
    const [value, nextSeed] = next;
    result.push(value);
    current = nextSeed;
  }
  return result;
}

// 1부터 10까지
unfold(n => (n > 10 ? null : [n, n + 1]), 1);
// [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// 피보나치 (처음 10개)
unfold(([a, b, count]) => count === 0 ? null : [a, [b, a + b, count - 1]], [0, 1, 10]);
// [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

## Hylomorphism — 생성 후 접기

Ana(펼치기) + Cata(접기)의 조합입니다. 씨앗에서 구조를 만들고 바로 접습니다.

```typescript
// hylo = ana + cata (중간 구조를 실제로 만들지 않고 바로 처리)
function hylo<A, B, S>(
  algebra: TreeAlgebra<A, B>,
  coalgebra: TreeCoalgebra<A, S>,
  seed: S,
): B {
  if (coalgebra.isLeaf(seed)) {
    return algebra.leaf(coalgebra.value(seed));
  }
  return algebra.node(
    coalgebra.value(seed),
    hylo(algebra, coalgebra, coalgebra.left(seed)),
    hylo(algebra, coalgebra, coalgebra.right(seed)),
  );
}

// 병합 정렬 = unfold(split) + fold(merge)
const mergeSortHylo = (arr: number[]): number[] =>
  hylo(
    {
      // cata: 합치기
      leaf: value => [value],
      node: (_, left, right) => merge(left, right), // 두 정렬된 배열 병합
    },
    {
      // ana: 나누기
      isLeaf: arr => arr.length <= 1,
      value: arr => arr[0],
      left: arr => arr.slice(0, Math.floor(arr.length / 2)),
      right: arr => arr.slice(Math.floor(arr.length / 2)),
    },
    arr,
  );
```

## 재귀 스킴의 분류

| 이름 | 방향 | 하는 일 |
|------|------|--------|
| **Catamorphism** (cata) | 아래 → 위 | 접기 (fold) |
| **Anamorphism** (ana) | 위 → 아래 | 펼치기 (unfold) |
| **Hylomorphism** (hylo) | ana + cata | 펼치고 접기 |
| **Paramorphism** (para) | cata 변형 | 접으면서 원본도 유지 |
| **Apomorphism** (apo) | ana 변형 | 펼치다 중간에 멈추기 |

## 정리

재귀 스킴은 "어떻게 재귀할지"와 "무엇을 할지"를 분리합니다.

- **Catamorphism**: 재귀 구조를 접는 모든 연산 — `sum`, `depth`, `toArray` 등
- **Anamorphism**: 값에서 재귀 구조를 펼치는 연산 — `range`, `unfold` 등
- **Hylomorphism**: 펼치고 접기 — 분할 정복 알고리즘의 본질

배열의 `reduce`(cata)와 `unfold`(ana), 트리 탐색이 모두 재귀 스킴의 인스턴스입니다. 이 개념을 알면 재귀 코드에서 반복 패턴을 빠르게 인식하고 추상화할 수 있습니다.
