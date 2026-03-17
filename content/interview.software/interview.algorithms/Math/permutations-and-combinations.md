---
title: "알고리즘: 순열(Permutation)과 조합(Combination)"
date: 2026-03-17
tags:
  - algorithm
  - interview
  - math
  - backtracking
  - permutation
  - combination
---

# 순열(Permutation)과 조합(Combination) 완벽 가이드

코딩 테스트에서 '모든 경우의 수를 탐색(완전 탐색, Brute Force)'해야 하는 문제 중 상당수는 **순열**과 **조합**을 베이스로 합니다. 이 두 가지 개념의 차이를 명확히 이해하고, 라이브러리 사용법뿐만 아니라 재귀(Backtracking)를 이용한 직접 구현까지 할 수 있어야 인터뷰에 완벽히 대비할 수 있습니다.

## 1. 순열과 조합의 차이점

가장 핵심적인 차이는 **'순서(Order)'를 고려하느냐**입니다.

### 순열 (Permutation)
*   **개념:** 서로 다른 $n$개에서 $r$개를 선택하여 **순서를 고려하여** 나열하는 경우의 수입니다.
*   **특징:** 순서가 다르면 다른 경우로 취급합니다. (예: `[A, B]`와 `[B, A]`는 다름)
*   **기호:** $_nP_r = \frac{n!}{(n-r)!}$
*   **예시:** 3명의 학생 중 반장, 부반장을 1명씩 뽑는 경우. (A가 반장, B가 부반장인 것과 B가 반장, A가 부반장인 것은 다름)

### 조합 (Combination)
*   **개념:** 서로 다른 $n$개에서 $r$개를 선택할 때, **순서를 고려하지 않고** 뽑는 경우의 수입니다.
*   **특징:** 순서가 달라도 구성 요소가 같으면 같은 경우로 취급합니다. (예: `[A, B]`와 `[B, A]`는 같음)
*   **기호:** $_nC_r = \frac{n!}{r!(n-r)!}$
*   **예시:** 3명의 학생 중 청소 당번 2명을 뽑는 경우. (A, B가 뽑히나 B, A가 뽑히나 똑같이 청소 당번임)

## 2. 파이썬 `itertools`를 활용한 구현

파이썬에서는 `itertools` 라이브러리를 제공하여 아주 쉽고 빠르게 순열과 조합을 구할 수 있습니다. 실제 코딩 테스트에서는 특별한 조건이 없다면 이 라이브러리를 적극 활용하는 것이 좋습니다.

```python
import itertools

data = ['A', 'B', 'C']

# 1. 순열 (Permutations)
# data에서 2개를 뽑아 순서를 고려하여 나열
perms = list(itertools.permutations(data, 2))
print("순열:", perms)
# 출력: [('A', 'B'), ('A', 'C'), ('B', 'A'), ('B', 'C'), ('C', 'A'), ('C', 'B')]

# 2. 조합 (Combinations)
# data에서 2개를 뽑아 순서 상관없이 나열
combs = list(itertools.combinations(data, 2))
print("조합:", combs)
# 출력: [('A', 'B'), ('A', 'C'), ('B', 'C')]

# (참고) 중복 순열: 중복을 허용하여 뽑고 순서를 고려함
prod = list(itertools.product(data, repeat=2))

# (참고) 중복 조합: 중복을 허용하여 뽑고 순서를 고려하지 않음
combs_with_rep = list(itertools.combinations_with_replacement(data, 2))
```

## 3. 재귀(Backtracking)를 이용한 직접 구현

인터뷰에서는 "라이브러리를 쓰지 말고 직접 구현해 보세요" 또는 "선택 과정 중간에 특정 조건을 넣어서 가지치기(Pruning)를 해보세요"라는 요구사항이 자주 나옵니다. 이때는 DFS 기반의 백트래킹(Backtracking)을 사용하여 구현합니다.

### 직접 구현: 순열 (Permutation)
순열은 이미 뽑은 원소를 다시 뽑으면 안 되므로, **`visited` (방문 여부) 배열**을 사용하여 중복 선택을 방지합니다.

```python
def make_permutations(arr, r):
    result = []
    visited = [False] * len(arr)
    
    def dfs(current_perm):
        # r개를 모두 뽑았다면 결과에 추가하고 종료
        if len(current_perm) == r:
            result.append(current_perm[:]) # 배열 복사 주의!
            return
            
        for i in range(len(arr)):
            if not visited[i]: # 아직 뽑지 않은 원소라면
                visited[i] = True # 방문 처리
                current_perm.append(arr[i]) # 선택
                
                dfs(current_perm) # 다음 원소 뽑으러 깊이 진입
                
                # 백트래킹: 되돌아와서 선택 취소
                current_perm.pop()
                visited[i] = False
                
    dfs([])
    return result

data = ['A', 'B', 'C']
print("직접 구현한 순열:", make_permutations(data, 2))
```

### 직접 구현: 조합 (Combination)
조합은 순서가 중요하지 않으므로, `[A, B]`를 뽑았다면 `[B, A]`는 다시 탐색할 필요가 없습니다. 이를 위해 **'현재 뽑은 원소의 다음 인덱스'**부터만 탐색하도록 `start` 변수를 활용합니다. 방문 배열(`visited`)이 필요 없습니다.

```python
def make_combinations(arr, r):
    result = []
    
    def dfs(start, current_comb):
        # r개를 모두 뽑았다면 결과에 추가하고 종료
        if len(current_comb) == r:
            result.append(current_comb[:]) # 배열 복사 주의!
            return
            
        # start 인덱스부터 끝까지만 탐색 (이전에 뽑은 것 앞부분은 쳐다보지 않음)
        for i in range(start, len(arr)):
            current_comb.append(arr[i]) # 선택
            
            # i + 1을 넘겨주어 중복과 순서 뒤바뀜 방지
            dfs(i + 1, current_comb) 
            
            # 백트래킹: 되돌아와서 선택 취소
            current_comb.pop()
            
    dfs(0, [])
    return result

data = ['A', 'B', 'C']
print("직접 구현한 조합:", make_combinations(data, 2))
```

## 4. 활용 사례

1.  **순열 활용:** 
    *   숫자 카드를 나열하여 가장 큰 수 만들기
    *   여행 경로(TSP, 모든 도시를 한 번씩 방문하는 경로) 경우의 수
    *   **키워드:** "나열한다", "순서대로", "줄을 세운다"
2.  **조합 활용:**
    *   팀 나누기, 조 편성하기
    *   무게 제한이 있는 배낭에 물건 담기 (일부)
    *   **키워드:** "뽑는다", "선택한다", "순서에 상관없이"

## 요약

*   **순열(Permutations):** 순서 O. `itertools.permutations`. 직접 구현 시 **방문 체크(`visited`)** 필수.
*   **조합(Combinations):** 순서 X. `itertools.combinations`. 직접 구현 시 **시작 인덱스(`start`)** 전달 필수.
*   단순히 결과를 내는 문제라면 `itertools`가 압도적으로 편하지만, 중간에 가지치기가 필요한 복잡한 탐색 문제에서는 백트래킹을 이용한 직접 구현 방식이 반드시 필요합니다.