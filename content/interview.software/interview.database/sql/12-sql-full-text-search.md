---
title: "[DB Master] 12. Full-Text Search: 검색 엔진 없는 고성능 텍스트 검색"
author: jeffrey
date: 2026-04-07
tags: ["sql", "full-text-search", "fts", "inverted-index", "ngram", "mecab", "postgresql", "mysql", "optimization"]
---

## Full-Text Search: 대량 텍스트의 정밀한 탐색

대부분의 관계형 데이터베이스(RDBMS) 조회는 정확한 값이나 문자열의 일부를 찾기 위해 `LIKE '%keyword%'`를 사용합니다. 하지만 수백만 건 이상의 텍스트 데이터가 쌓이면 `LIKE` 검색은 인덱스를 타지 못해 Full Table Scan이라는 재앙을 초래합니다.

**Full-Text Search (FTS)**는 데이터베이스 엔진이 내부적으로 검색 엔진(Elasticsearch 등)의 원리를 차용하여, 텍스트를 의미 있는 단위로 쪼개고 검색 성능을 극대화하는 기술입니다. 이 기술의 핵심인 **역색인(Inverted Index)**과 **형태소 분석**을 분석합니다.

---

## 1. [Physical Depth] 역색인(Inverted Index)의 물리적 구조

FTS의 성능은 일반 B+Tree 인덱스가 아닌 **역색인** 구조에서 나옵니다.

### 1.1 동작 원리

1. 텍스트 분절 (Tokenizing): 문장을 개별 단어(Token)로 쪼갭니다.
2. 매핑: 각 단어가 어떤 행(Row ID)에 포함되어 있는지 매핑된 표를 미리 만듭니다.
3. 검색: 검색어가 들어오면 해당 단어가 포함된 행 리스트만 즉시 응답합니다.

> **핵심 원리**: 검색 대상이 10억 개여도, 검색어가 포함된 행이 10개라면 엔진은 단 10개의 리스트만 읽습니다. 이 차이가 `LIKE` 검색과의 성능 격차를 수천 배로 벌립니다.

---

## 2. 실전: MySQL과 PostgreSQL의 FTS 구현

### 2.1 MySQL (N-Gram 파서)

MySQL은 단어를 의미가 아닌 글수 단위로 쪼개는 N-Gram 방식을 주로 씁니다.

```sql
-- 1. 전문 검색 인덱스 생성 (2글자 단위로 쪼개기)
ALTER TABLE posts ADD FULLTEXT INDEX idx_content (content) WITH PARSER ngram;

-- 2. 검색 실행
SELECT * FROM posts 
WHERE MATCH(content) AGAINST('데이터베이스' IN NATURAL LANGUAGE MODE);
```

### 2.2 PostgreSQL (TsVector와 형태소 분석기)

PostgreSQL은 텍스트를 정규화한 `tsvector` 타입을 사용하여 고도로 정밀한 검색이 가능합니다.

```sql
-- 조인과 가중치를 이용한 상세 검색 지원
SELECT title, ts_rank(to_tsvector(content), query) as rank
FROM posts, to_tsquery('master & sql') query
WHERE query @@ to_tsvector(content)
ORDER BY rank DESC;
```

---

## 3. 형태소 분석 vs N-Gram: 데이터의 성질에 따른 선택

- **N-Gram**: 글자 수 단위(예: 2글자씩)로 무조건 쪼갭니다. 한글이나 영어가 섞인 복합 명사 검색에 강점이 있지만, 인덱스 크기가 커진다는 단점이 있습니다.
- **형태소 분석(Mecab 등)**: 언어의 문법 구조를 파악해 단어의 원형을 추출합니다. 정밀도가 높으나 언어별 분석기 설치가 필요합니다.

---

## 4. [Interview Master] 언제 Elasticsearch로 넘어가는가?

면접관이 묻습니다: **"DB에도 FTS가 있는데, 왜 굳이 Elasticsearch나 Algolia를 별도로 구축합니까?"**

시니어의 답변은 이렇습니다:
**"DB의 FTS는 데이터 정합성이 중요하고 검색 빈도가 낮을 때 훌륭합니다. 하지만 대량의 로그를 수집하거나, 검색어 추천(Suggest), 오타 보정(Fuzzy Search), 동적인 필터링 등 고도화된 UI/UX 검색 경험이 핵심이라면 검색 전용 엔진으로 이관하는 것이 맞습니다. DB는 저장과 무결성에 최적화되어 있지, 복잡한 비정형 텍스트의 랭킹(Ranking) 연산에는 한계가 있기 때문입니다."**

---

## 5. Full-Text Search 최적화 수칙

1. 인덱스 갱신 오버헤드 주의: 전문 검색 인덱스는 일반 인덱스보다 훨씬 무겁습니다. 쓰기(Insert/Update)가 매우 잦은 테이블에 FTS를 걸면 성능이 저하될 수 있습니다.
2. 불용어(Stopwords) 관리: '은, 는, 이, 가' 같은 무의미한 단어들을 인덱스에서 제외하여 공간 낭비와 소음을 제거하십시오.
3. 데이터 타입 선정: 영문의 경우 영어 전용 파서를, 다국어 환경에서는 유니코드 처리가 우수한 파서를 선택해야 합니다.
