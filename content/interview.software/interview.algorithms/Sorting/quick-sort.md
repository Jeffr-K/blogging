---
title: "정렬 알고리즘: 퀵 정렬 (Quick Sort)"
date: 2026-03-17
tags:
  - algorithm
  - interview
  - sorting
  - quick-sort
---

# 퀵 정렬 (Quick Sort) 완벽 가이드

소프트웨어 엔지니어링 인터뷰에서 가장 빈번하게 묻고, 실무에서도 널리 쓰이는 가장 중요한 정렬 알고리즘 중 하나인 **퀵 정렬(Quick Sort)**에 대해 알아보겠습니다.

## 1. 퀵 정렬이란?

퀵 정렬은 **분할 정복(Divide and Conquer)** 알고리즘을 기반으로 매우 빠른 속도를 자랑하는 정렬 방법입니다.

하나의 기준점(**피벗, Pivot**)을 정하고, 이 피벗보다 작은 값들은 왼쪽으로, 큰 값들은 오른쪽으로 모으는 과정을 재귀적으로 반복하여 정렬을 완성합니다.

## 2. 동작 과정 (오름차순 기준)

1.  **피벗(Pivot) 선택:** 배열 안의 한 요소를 피벗으로 선택합니다. (보통 첫 번째, 마지막, 또는 중간값을 선택)
2.  **분할 (Partition):** 
    *   피벗을 기준으로 두 개의 포인터(왼쪽, 오른쪽)를 사용하여 탐색합니다.
    *   피벗보다 작은 요소들은 모두 피벗의 왼쪽으로, 큰 요소들은 모두 오른쪽으로 이동시킵니다.
    *   이 분할 과정이 끝나면 피벗은 배열 내에서 최종적으로 자신의 정렬된 위치를 확정 짓게 됩니다.
3.  **재귀적 정복:** 피벗을 제외한 왼쪽 부분 배열과 오른쪽 부분 배열에 대해 다시 동일한 과정(피벗 선택 및 분할)을 재귀적으로 수행합니다.
4.  부분 배열의 크기가 1 이하가 되면 정렬이 완료된 것으로 간주하고 재귀를 종료합니다.

## 3. 파이썬(Python) 구현 예시

파이썬의 리스트 컴프리헨션을 사용하면 퀵 정렬을 매우 직관적으로 구현할 수 있습니다. (단, 메모리를 추가로 사용하므로 엄밀한 제자리 정렬은 아닙니다.)

### 직관적인 방식 (추가 메모리 사용)
```python
def quick_sort_pythonic(arr):
    if len(arr) <= 1:
        return arr
    
    pivot = arr[len(arr) // 2] # 가운데 원소를 피벗으로 설정
    left, equal, right = [], [], []
    
    for num in arr:
        if num < pivot:
            left.append(num)
        elif num > pivot:
            right.append(num)
        else:
            equal.append(num)
            
    # 분할된 배열들을 재귀적으로 정렬 후 병합
    return quick_sort_pythonic(left) + equal + quick_sort_pythonic(right)
```

### 정석적인 제자리 정렬(In-place) 방식
인터뷰에서는 추가 메모리를 쓰지 않는 인플레이스(In-place) 방식을 요구하는 경우가 많습니다.

```python
def quick_sort_inplace(arr, low, high):
    if low < high:
        # 분할 후 피벗의 확정된 위치 인덱스를 받음
        pivot_idx = partition(arr, low, high)
        
        # 피벗을 제외한 양쪽 부분 배열 재귀 정렬
        quick_sort_inplace(arr, low, pivot_idx - 1)
        quick_sort_inplace(arr, pivot_idx + 1, high)

def partition(arr, low, high):
    pivot = arr[high] # 마지막 원소를 피벗으로 선택
    i = low - 1 # 피벗보다 작은 원소들이 들어갈 마지막 인덱스
    
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i] # 자리 교환
            
    # 피벗을 제자리로 이동 (작은 원소들 바로 다음 위치)
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1 # 확정된 피벗의 인덱스 반환

# 사용 예시
data = [10, 7, 8, 9, 1, 5]
quick_sort_inplace(data, 0, len(data) - 1)
print("정렬 후:", data)
```

## 4. 시간 복잡도 및 공간 복잡도

*   **시간 복잡도:**
    *   **평균 및 최선의 경우:** **$O(N \log N)$** (피벗이 배열을 항상 절반씩 나눌 때)
    *   **최악의 경우:** $O(N^2)$ (이미 정렬된 배열에서 맨 처음/맨 끝 원소를 피벗으로 계속 고를 때, 분할이 한쪽으로만 치우침)
*   **공간 복잡도:**
    *   In-place 방식: $O(\log N)$ (재귀 호출로 인한 콜 스택 메모리)

## 5. 특징

*   **장점:** 이름처럼 **평균적으로 가장 빠릅니다.** 캐시 지역성(Cache Locality)이 좋아 다른 $O(N \log N)$ 알고리즘보다 실제 실행 속도가 빠릅니다. 추가 메모리를 사용하지 않는 제자리 정렬(In-place)이 가능합니다.
*   **단점:** **불안정 정렬(Unstable Sort)**이며, 최악의 경우 시간 복잡도가 $O(N^2)$으로 악화될 수 있습니다. (이를 방지하기 위해 랜덤 피벗 선택 등 다양한 최적화 기법이 존재합니다.)

## 요약

퀵 정렬은 피벗을 기준으로 데이터를 분할하여 재귀적으로 정렬하는 $O(N \log N)$ 알고리즘입니다. 인터뷰에서는 분할(Partition) 로직을 정확히 구현할 수 있는지, 그리고 최악의 경우 $O(N^2)$이 발생하는 조건과 이를 회피하기 위한 방법(예: 랜덤 피벗)을 설명할 수 있는지가 핵심 평가 요소입니다.