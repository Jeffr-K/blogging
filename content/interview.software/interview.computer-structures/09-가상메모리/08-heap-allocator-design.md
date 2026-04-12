---
title: "힙 메모리 관리: 명시적 할당기 (Explicit Allocator) 설계"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "virtual-memory", "heap", "allocator", "csapp"]
---

## 명시적 할당기 (Explicit Allocator)

프로그래머가 직접 `malloc`/`free`를 호출하는 방식입니다. CSAPP Malloc Lab의 핵심 구현 대상입니다.

---

## 1. 할당기 설계 목표

```
처리율 (Throughput):
  단위 시간당 malloc/free 처리 횟수 최대화
  목표: 각 연산 O(1) 또는 O(log n)

메모리 이용률 (Memory Utilization):
  최대 이용률 = 최대 페이로드 합 / 현재 힙 크기
  단편화를 최소화해야 함

Trade-off:
  처리율 ↑ vs 이용률 ↑ → 동시에 달성하기 어려움
  예: Best Fit = 이용률 좋지만 느림
      Fast Bin = 빠르지만 단편화 가능
```

---

## 2. 명시적 가용 리스트 구현

```
해제 블록 구조 (64비트):
  ┌──────────┬──────────┬──────────┬──────────┐
  │ 헤더(8B) │ prev(8B) │ next(8B) │ 풋터(8B) │
  └──────────┴──────────┴──────────┴──────────┘
  최소 블록 크기: 32바이트

할당 블록 구조:
  ┌──────────┬──────────────────────┐
  │ 헤더(8B) │     페이로드(n바이트)  │
  └──────────┴──────────────────────┘
  (풋터 불필요 → 이전 블록이 해제된 경우만 필요)

free_list_head → [블록A] ↔ [블록B] ↔ [블록C] → NULL
```

---

## 3. malloc 구현

```c
// 의사 코드
void *malloc(size_t size) {
    size_t asize = align(size + HEADER_SIZE); // 정렬 및 헤더 포함
    
    // 1. 가용 리스트에서 적합한 블록 탐색 (First Fit)
    block_t *bp = free_list_head;
    while (bp != NULL) {
        if (get_size(bp) >= asize) {
            // 2. 블록 분할 (남은 크기가 최소 블록 이상이면)
            if (get_size(bp) >= asize + MIN_BLOCK_SIZE) {
                split_block(bp, asize);
            }
            // 3. 가용 리스트에서 제거
            remove_from_free_list(bp);
            // 4. 할당 표시
            set_alloc(bp);
            return get_payload(bp);
        }
        bp = get_next_free(bp);
    }
    
    // 5. 가용 블록 없음 → 힙 확장
    bp = extend_heap(MAX(asize, CHUNK_SIZE));
    remove_from_free_list(bp);
    set_alloc(bp);
    return get_payload(bp);
}
```

---

## 4. free 구현

```c
void free(void *ptr) {
    if (ptr == NULL) return;
    
    block_t *bp = get_block(ptr); // 페이로드 → 헤더
    set_free(bp); // 할당 해제 표시
    
    // 즉시 합병 (4가지 경우)
    block_t *prev = get_prev_block(bp); // 풋터로 역참조
    block_t *next = get_next_block(bp);
    
    bool prev_alloc = is_alloc(prev);
    bool next_alloc = is_alloc(next);
    
    if (prev_alloc && next_alloc) {
        // Case 1: 앞뒤 모두 할당 → 그냥 리스트에 추가
        insert_free_list(bp);
        
    } else if (prev_alloc && !next_alloc) {
        // Case 2: 다음 블록이 해제됨 → bp + next 합병
        remove_from_free_list(next);
        coalesce(bp, next);
        insert_free_list(bp);
        
    } else if (!prev_alloc && next_alloc) {
        // Case 3: 이전 블록이 해제됨 → prev + bp 합병
        remove_from_free_list(prev);
        coalesce(prev, bp);
        insert_free_list(prev);
        
    } else {
        // Case 4: 앞뒤 모두 해제됨 → prev + bp + next 합병
        remove_from_free_list(prev);
        remove_from_free_list(next);
        coalesce(prev, bp);
        coalesce(prev, next);
        insert_free_list(prev);
    }
}
```

---

## 5. 분리 가용 리스트 (Segregated Free List)

```
크기 클래스별 별도 리스트:
  class[0]: {16~32}
  class[1]: {33~64}
  class[2]: {65~128}
  class[3]: {129~256}
  ...
  class[k]: {2^(k+4)+1 ~ 2^(k+5)}

malloc(size):
  1. size에 맞는 클래스 찾기
  2. 해당 클래스 리스트에서 탐색
  3. 없으면 다음 클래스로 올라감
  4. 그래도 없으면 힙 확장

장점:
  ✓ 탐색 범위 대폭 축소 → O(1) ~ O(log n)
  ✓ 비슷한 크기끼리 관리 → 외부 단편화 감소
  ✓ 대용량 요청에 큰 블록 낭비 없음
```

---

## 6. 정렬 요구사항

```
이유: CPU는 정렬된 주소에서 데이터 접근이 빠름
  일부 아키텍처(RISC)는 비정렬 접근 시 예외 발생

x86-64 요구사항:
  malloc 반환 주소: 16바이트 정렬 (double의 2배)
  
  예: malloc(1) → 최소 16바이트 할당, 16바이트 정렬
  예: malloc(17) → 32바이트 할당 (16바이트 단위 올림)

내부 단편화:
  malloc(1) → 실제 16바이트 사용 → 15바이트 낭비
  불가피한 비용 (정렬 + 헤더 오버헤드)
```

---

## 핵심 요약

- **명시적 할당기**: 프로그래머가 malloc/free로 직접 관리.
- **블록 구조**: 헤더(크기+할당여부) + 페이로드 [+ 풋터(해제 블록만)].
- **합병 4경우**: free 시 이전/다음 블록 할당 상태에 따라 합병.
- **분리 리스트**: 크기 클래스별 리스트로 O(1) 근접 할당.
- **Trade-off**: 처리율(속도) ↔ 이용률(단편화 감소) 균형이 핵심.
