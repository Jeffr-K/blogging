---
title: "가비지 컬렉션 (Garbage Collection): 표시-청소, 참조 카운팅"
author: jeffrey
date: 2026-04-11
tags: ["computer-architecture", "virtual-memory", "garbage-collection", "csapp"]
---

## 가비지 컬렉션 (GC)

프로그래머가 직접 `free()`를 호출하지 않아도, **접근 불가능한 메모리를 자동으로 회수**하는 메커니즘입니다.

---

## 1. GC의 기본 아이디어

```
가비지(Garbage) = 더 이상 참조되지 않는(도달 불가능한) 객체

도달 가능성 (Reachability):
  루트 집합(Root Set): 스택 변수, 전역 변수
  루트에서 포인터를 따라 도달할 수 있는 객체 = 살아있음
  그 외 = 가비지 → 회수 대상

        루트
         │
    ┌────┴────┐
    ↓         ↓
  [A]        [B] → [C]
   │
   └──→ [D]
   
[E] ←→ [F]  ← 서로 참조하지만 루트에서 도달 불가 = 가비지!
```

---

## 2. 표시-청소 (Mark-and-Sweep) GC

```
단계:
  Phase 1 - Mark (표시):
    루트 집합에서 시작하여 DFS/BFS
    도달 가능한 모든 객체에 마크 비트 설정
    
  Phase 2 - Sweep (청소):
    힙 전체를 선형 스캔
    마크 없는 객체 → 가비지 → 가용 리스트에 추가
    마크된 객체 → 마크 비트 초기화 (다음 GC를 위해)

장점:
  ✓ 순환 참조도 회수 가능
  ✓ 구현 단순

단점:
  ✗ STW (Stop-The-World): GC 중 프로그램 멈춤
  ✗ 외부 단편화 발생 (압축 없으면)
  ✗ Mark 단계: O(힙 크기)

사용: 초기 Java GC, Python gc 모듈
```

---

## 3. 표시-압축 (Mark-and-Compact) GC

```
Mark-and-Sweep + 압축:
  살아있는 객체를 힙의 한쪽으로 이동
  모든 포인터 업데이트
  → 외부 단편화 없음
  → 이후 할당이 O(1) (bump pointer 할당)

단점:
  ✗ 더 긴 STW (포인터 업데이트)
  ✗ 구현 복잡

사용: JVM Serial/Parallel GC의 Old Generation
```

---

## 4. 참조 카운팅 (Reference Counting)

```
각 객체에 참조 횟수(ref count) 저장:
  객체 참조 추가 시: ref_count++
  참조 제거 시:      ref_count--
  ref_count == 0: 즉시 해제

장점:
  ✓ STW 없음 (점진적 GC)
  ✓ 즉시 회수 → 메모리 효율적
  ✓ 구현 단순

단점 1: 순환 참조 누수
  [A] → [B] → [A] (서로 참조)
  두 객체 모두 ref_count ≥ 1
  외부에서 참조 없어도 회수 불가 → 누수!

단점 2: 성능 오버헤드
  모든 참조 변경 시 카운터 업데이트 (원자 연산)
  캐시 효율 저하

순환 참조 해결:
  약한 참조 (Weak Reference): ref_count 증가 없음
  Python: gc 모듈로 순환 참조 감지
  Rust: Rc<T> (RC) + Weak<T>

사용: CPython, Swift ARC, Rust Rc<T>
```

---

## 5. 세대별 GC (Generational GC)

```
가설: 대부분 객체는 일찍 죽는다 (Generational Hypothesis)
  새로 만든 객체 = 곧 죽을 가능성 높음
  오래된 객체 = 계속 살아있을 가능성 높음

세대 분류 (JVM 예시):
  Young Generation (Eden + Survivor): 새 객체
    Minor GC: 자주, 빠름 (작은 공간만 청소)
  Old Generation (Tenured): 살아남은 객체
    Major/Full GC: 드물게, 느림

동작:
  1. 새 객체 → Eden 영역에 할당
  2. Eden 가득 참 → Minor GC
  3. 살아남은 객체 → Survivor 영역
  4. N번 Minor GC 생존 → Old Generation 승격
  5. Old 가득 참 → Major GC (Full GC)

효과:
  Minor GC만으로 대부분 처리 → 짧은 STW
  Old GC는 드물게 발생
```

---

## 6. GC 알고리즘 비교

```
알고리즘          │ 처리량  │ 지연     │ 단편화   │ 순환참조
──────────────────┼─────────┼──────────┼──────────┼─────────
Mark-and-Sweep    │ 중간    │ STW 있음 │ 있음     │ 처리
Mark-and-Compact  │ 낮음    │ STW 긺   │ 없음     │ 처리
참조 카운팅       │ 높음    │ STW 없음 │ 없음     │ 미처리
세대별 GC         │ 높음    │ STW 짧음 │ 적음     │ 처리
G1 GC             │ 높음    │ 예측 가능│ 적음     │ 처리
ZGC/Shenandoah    │ 높음    │ <10ms   │ 없음     │ 처리
```

---

## 핵심 요약

- **가비지**: 루트에서 도달 불가능한 메모리.
- **Mark-and-Sweep**: 도달 가능 객체 표시 → 미표시 객체 회수. 순환 참조 처리.
- **참조 카운팅**: 즉시 회수, STW 없음. 하지만 순환 참조 누수.
- **세대별 GC**: 젊은 세대를 자주 청소 → 짧은 STW.
- **C/C++**: GC 없음. 프로그래머가 직접 관리 (속도↑, 안전성↓).
