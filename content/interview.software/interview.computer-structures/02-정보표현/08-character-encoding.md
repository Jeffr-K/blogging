---
title: "문자 인코딩: ASCII, UTF-8, UTF-16"
author: jeffrey
date: 2026-04-09
tags: ["computer-architecture", "encoding", "ascii", "utf-8", "utf-16", "unicode", "csapp"]
---

## 문자 인코딩

컴퓨터는 숫자만 저장할 수 있습니다. 문자를 저장하려면 각 문자에 숫자를 대응시키는 **인코딩(Encoding)** 체계가 필요합니다.

---

## 1. ASCII (American Standard Code for Information Interchange)

1963년에 만들어진 최초의 표준 문자 인코딩. **7비트**로 128개 문자를 표현합니다.

```
0-31:   제어 문자 (줄바꿈, 탭 등)
32:     공백(Space)
48-57:  '0'-'9' (숫자)
65-90:  'A'-'Z' (대문자)
97-122: 'a'-'z' (소문자)
127:    DEL
```

### 주요 ASCII 값

```c
'A' = 65 = 0x41
'a' = 97 = 0x61  (대소문자 차이: 32 = 0x20)
'0' = 48 = 0x30
' ' = 32 = 0x20
'\n' = 10 = 0x0A (줄바꿈)
'\t' = 9  = 0x09 (탭)
```

### ASCII 활용

```c
// 대소문자 변환 (비트 연산)
char to_lower(char c) {
    return c | 0x20;   // 5번째 비트를 1로 (대→소)
}
char to_upper(char c) {
    return c & ~0x20;  // 5번째 비트를 0으로 (소→대)
}

// 숫자 문자 → 정수
int char_to_digit(char c) {
    return c - '0';    // '5' - '0' = 5
}
```

---

## 2. 유니코드 (Unicode)

ASCII는 영어만 표현 가능. 전 세계 모든 문자를 표현하기 위해 유니코드가 등장했습니다.

유니코드는 각 문자에 **코드 포인트(Code Point)**를 부여합니다. `U+` 표기법 사용.

```
'A'    = U+0041
'가'   = U+AC00
'😀'   = U+1F600
'한'   = U+D55C
현재 약 149,000개 문자 정의 (총 1,114,112개 공간)
```

유니코드는 **문자 집합(Character Set)**이고, UTF-8, UTF-16, UTF-32는 이를 **바이트로 인코딩하는 방법**입니다.

---

## 3. UTF-8

현재 가장 널리 사용되는 인코딩. **가변 길이(1~4바이트)**.

### 인코딩 규칙

| 코드 포인트 범위 | 바이트 수 | 비트 패턴 |
|----------------|---------|----------|
| U+0000 ~ U+007F | 1바이트 | 0xxxxxxx |
| U+0080 ~ U+07FF | 2바이트 | 110xxxxx 10xxxxxx |
| U+0800 ~ U+FFFF | 3바이트 | 1110xxxx 10xxxxxx 10xxxxxx |
| U+10000 ~ U+10FFFF | 4바이트 | 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx |

### 예시: '가' (U+AC00) 인코딩

```
U+AC00 = 1010 1100 0000 0000₂

U+0800 ~ U+FFFF 범위 → 3바이트 필요
패턴: 1110xxxx 10xxxxxx 10xxxxxx

AC00 = 1010 1100 0000 0000
분할:  1010 | 110000 | 000000

결과: 11101010 10110000 10000000
    = 0xEA     0xB0     0x80
```

### UTF-8의 장점

```
✓ ASCII 호환: ASCII 문자는 그대로 1바이트
✓ 영어 텍스트는 공간 효율적 (1바이트/문자)
✓ 자기 동기화: 손상된 스트림에서 다음 문자 시작점 찾기 쉬움
✓ 빅 엔디안/리틀 엔디안 문제 없음 (바이트 단위)
✓ 웹의 표준 (HTML 기본 인코딩)
```

```python
# Python에서 UTF-8
s = "안녕"
encoded = s.encode('utf-8')
print(encoded)  # b'\xec\x95\x88\xeb\x85\x95' (각 문자 3바이트)
print(len(s))       # 2 (문자 수)
print(len(encoded)) # 6 (바이트 수)
```

---

## 4. UTF-16

**가변 길이(2바이트 또는 4바이트)**.

| 코드 포인트 범위 | 바이트 수 |
|----------------|---------|
| U+0000 ~ U+FFFF (기본 다국어 평면, BMP) | 2바이트 |
| U+10000 ~ U+10FFFF (서로게이트 쌍) | 4바이트 |

```
'A'  = U+0041 → 0x00 0x41 (또는 0x41 0x00, 엔디안에 따라)
'가' = U+AC00 → 0xAC 0x00
'😀' = U+1F600 → 서로게이트 쌍: 0xD83D 0xDE00 (4바이트)
```

### UTF-16의 특징

- **Windows, Java, JavaScript**: 내부적으로 UTF-16 사용
- **엔디안 문제**: BOM(Byte Order Mark, `U+FEFF`)으로 엔디안 표시
- **C에서 `wchar_t`**: Windows에서 UTF-16, Linux에서 UTF-32

```c
// Windows에서 UTF-16 문자열
wchar_t *ws = L"안녕";
wprintf(L"%ls\n", ws);

// Java에서 char는 UTF-16 코드 유닛
char c = '가';  // U+AC00, 2바이트
// 이모지같은 4바이트 문자는 char 2개 필요 (서로게이트 쌍)
```

---

## 5. UTF-32 (UCS-4)

**고정 길이(4바이트)**. 모든 유니코드 코드 포인트를 4바이트로 표현.

```
'A'  = 0x00000041
'가' = 0x0000AC00
'😀' = 0x0001F600
```

- **장점**: 인덱싱이 O(1). n번째 문자에 바로 접근 가능.
- **단점**: 공간 낭비 심함. 영어 텍스트도 4배 용량.
- **사용**: Python 3 내부(CPython), 일부 내부 처리

---

## 6. 인코딩 관련 함정

### 6.1 문자 수 vs 바이트 수

```python
s = "안녕😀"
print(len(s))               # 3 (문자 수)
print(len(s.encode('utf-8'))) # 10 (3×3 + 4 바이트)
```

### 6.2 잘린 UTF-8 문자

```c
// 3바이트 UTF-8 문자를 2바이트만 자르면 유효하지 않은 시퀀스
char buf[3] = {0xEA, 0xB0, 0};  // '가'에서 1바이트 누락 → 깨진 문자
```

### 6.3 BOM(Byte Order Mark) 처리

```python
# UTF-8 with BOM (Windows 메모장 기본값)
with open('file.txt', 'rb') as f:
    data = f.read()
    if data.startswith(b'\xef\xbb\xbf'):
        print("UTF-8 with BOM")
        data = data[3:]  # BOM 제거

# Python에서 자동 처리
with open('file.txt', encoding='utf-8-sig') as f:  # BOM 자동 제거
    content = f.read()
```

---

## 핵심 요약

| 인코딩 | 크기 | 특징 |
|--------|------|------|
| ASCII | 7비트(1바이트) | 영어 128자. 가장 단순. |
| UTF-8 | 1~4바이트 | ASCII 호환. 웹 표준. 현재 가장 널리 사용. |
| UTF-16 | 2 또는 4바이트 | Windows, Java, JavaScript 내부 사용. 엔디안 주의. |
| UTF-32 | 4바이트 고정 | 인덱싱 O(1)이지만 공간 낭비. |

- **"문자 수 ≠ 바이트 수"**: UTF-8에서 한글은 3바이트, 이모지는 4바이트.
- **파일 입출력 시 인코딩 명시**: `open(file, encoding='utf-8')`.
- **네트워크 데이터는 바이트**: 인코딩/디코딩 경계를 명확히 하세요.
