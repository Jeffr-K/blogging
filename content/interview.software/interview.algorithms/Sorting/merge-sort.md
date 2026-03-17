---
title: "정렬 알고리즘: 병합 정렬 (Merge Sort)"
date: 2026-03-17
tags:
  - algorithm
  - interview
  - sorting
  - merge-sort
---

# 병합 정렬 (Merge Sort) 완벽 가이드

퀵 정렬과 함께 $O(N \log N)$의 성능을 내는 대표적인 알고리즘이자, 분할 정복(Divide and Conquer)의 정석을 보여주는 **병합 정렬(Merge Sort)**에 대해 알아보겠습니다.

## 1. 병합 정렬이란?

병합 정렬은 배열을 계속해서 반으로 쪼개어 크기가 1인 배열로 만든 다음, 이들을 다시 정렬하면서 하나로 합쳐(Merge) 나가는 알고리즘입니다.

'분할(Divide)'과 '정복(Conquer)' 그리고 '결합(Combine)'의 세 단계를 명확히 거칩니다.

## 2. 동작 과정

1.  **분할 (Divide):** 주어진 리스트를 절반으로 나눕니다.
2.  이 과정을 부분 리스트의 길이가 1이 될 때까지 재귀적으로 반복합니다.
3.  **정복 및 병합 (Conquer & Merge):** 인접한 두 개의 부분 리스트를 정렬하면서 하나의 리스트로 병합합니다.
4.  이 병합 과정을 원래 리스트의 크기가 될 때까지 반복하여 최종적으로 정렬된 리스트를 얻습니다.

핵심은 **'이미 정렬된 두 개의 리스트를 합치는 과정'**입니다. 두 리스트의 첫 원소부터 비교하면서 더 작은 값을 새로운 리스트에 차례대로 담으면 됩니다.

## 3. 파이썬(Python) 구현 예시

```python
def merge_sort(arr):
    # 리스트의 길이가 1 이하면 이미 정렬된 것으로 간주
    if len(arr) <= 1:
        return arr
    
    # 1. 분할 (Divide)
    mid = len(arr) // 2
    left_half = arr[:mid]
    right_half = arr[mid:]
    
    # 재귀적으로 절반씩 계속 나눔
    left_half = merge_sort(left_half)
    right_half = merge_sort(right_half)
    
    # 2. 병합 (Merge)
    return merge(left_half, right_half)

def merge(left, right):
    merged = []
    i, j = 0, 0
    
    # 두 리스트의 원소를 비교하며 작은 값을 merged 리스트에 추가
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
            
    # 남아있는 원소들 일괄 추가
    # 한쪽 리스트가 먼저 소진되면, 남은 리스트는 그대로 뒤에 붙임
    merged.extend(left[i:])
    merged.extend(right[j:])
    
    return merged

# 사용 예시
data = [38, 27, 43, 3, 9, 82, 10]
print("정렬 전:", data)
print("정렬 후:", merge_sort(data))
```

## 4. 시간 복잡도 및 공간 복잡도

*   **시간 복잡도:**
    *   **최악, 최선, 평균 모두 $O(N \log N)$** 입니다. 
    *   반으로 쪼개는 깊이($\log N$) $\times$ 각 단계에서 병합 시 원소를 비교하는 횟수($N$). 데이터 분포에 영향을 받지 않고 항상 일정한 성능을 보장합니다.
*   **공간 복잡도:** **$O(N)$**
    *   병합 과정을 위해 원소들을 담을 추가적인 배열 공간(위 코드의 `merged` 리스트)이 필요합니다. 이는 병합 정렬의 가장 큰 단점입니다.

## 5. 특징

*   **장점:**
    *   어떤 데이터가 주어져도 항상 $O(N \log N)$의 준수한 속도를 보장합니다.
    *   **안정 정렬(Stable Sort)**입니다. (크기가 같은 원소의 상대적 위치가 변하지 않음)
    *   연결 리스트(Linked List)를 정렬할 때 포인터만 변경하면 되므로(제자리 정렬 가능), 연결 리스트 정렬에 매우 효율적입니다.
*   **단점:**
    *   배열 정렬 시, 임시 배열을 위한 추가적인 메모리 공간($O(N)$)이 필요합니다. (In-place 정렬이 아님)

## 요약

병합 정렬은 데이터를 완전히 잘게 쪼갠 후 정렬하면서 다시 합치는 구조로, 항상 $O(N \log N)$의 성능을 보장하는 안정적인 정렬입니다. 퀵 정렬과 비교할 때, 속도는 비슷하지만 메모리를 더 먹는 대신 안정 정렬이라는 확실한 트레이드오프가 존재합니다. 인터뷰 시 `merge` 함수의 로직(투 포인터를 이용한 병합)을 구현하는 것이 가장 핵심 포인트입니다.