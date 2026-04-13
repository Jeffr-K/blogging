# 집계와 그룹화 (Aggregation)

수많은 로우(Row) 데이터를 의미 있는 숫자 하나로 요약하는 법을 배웁니다. 쇼핑몰의 일일 매출이나 평균 배송 기간 등을 계산할 때 필수적입니다.

---

## 1. 집계 함수 (Aggregate Functions)

데이터의 개수, 합계, 평균 등을 구합니다.

- **이게 뭐예요?**:
  - `COUNT`: 행의 개수
  - `SUM`: 합계
  - `AVG`: 평균
  - `MIN/MAX`: 최소/최대값
- **문법**:

    ```sql
    SELECT SUM(컬럼명) FROM 테이블명;
    ```

- **기본 예제**:

    ```sql
    -- 총 회원 수 계산
    SELECT COUNT(*) FROM users;
    ```

- **실무 활용 (커머스)**: **"일일 총 매출액 정산"**
  - **왜 쓰는가?**: 개별 주문 내역을 하나씩 보는 대신, 어제 하루 동안 일어난 전체 거래액의 합을 구하여 비즈니스 성과를 파악하기 위해 사용합니다.
  - **예시**: `SELECT SUM(total_price) FROM orders WHERE order_date = '2024-04-12';`

---

## 2. GROUP BY (그룹화)

특정 기준에 따라 데이터를 묶고 통계를 냅니다.

- **이게 뭐예요?**: 같은 값을 가진 행들을 하나의 그룹으로 묶고, 그 그룹별로 집계 함수를 적용합니다.
- **문법**:

    ```sql
    SELECT 컬럼명, 집계함수() FROM 테이블명 GROUP BY 컬럼명;
    ```

- **기본 예제**:

    ```sql
    -- 성별로 나누어 회원 수 집계
    SELECT gender, COUNT(*) FROM users GROUP BY gender;
    ```

- **실무 활용 (커머스)**: **"카테고리별 상품 수 파악"**
  - **왜 쓰는가?**: 우리 쇼핑몰의 상품이 어떤 카테고리에 많이 쏠려 있는지 분포를 확인할 때 사용합니다.
  - **예시**: `SELECT category_id, COUNT(*) as product_cnt FROM products GROUP BY category_id;`

---

## 3. HAVING (그룹 필터링)

그룹화된 결과 중에서 필요한 것만 골라냅니다.

- **이게 뭐예요?**: `GROUP BY`로 묶인 그룹 결과에 필터를 겁니다. (`WHERE`가 묶기 전 개별 데이터라면, `HAVING`은 묶은 후의 결과입니다.)
- **문법**:

    ```sql
    SELECT 컬럼명, 집계함수() FROM 테이블명 GROUP BY 컬럼명 HAVING 조건;
    ```

- **기본 예제**:

    ```sql
    -- 회원 수가 100명 이상인 모집단만 보기
    SELECT location, COUNT(*) FROM users GROUP BY location HAVING COUNT(*) >= 100;
    ```

- **실무 활용 (커머스)**: **"인기 카테고리만 추려내기"**
  - **왜 쓰는가?**: 모든 카테고리를 다 보는 게 아니라, '평균 상품 단가가 5만 원 이상인 고급 브랜드 카테고리'만 따로 분석하고 싶을 때 사용합니다.
  - **예시**: `SELECT category_id, AVG(price) FROM products GROUP BY category_id HAVING AVG(price) >= 50000;`
