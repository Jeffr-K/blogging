# 데이터 조회 기초 (DQL)

데이터베이스에서 원하는 정보를 찾아내는 법을 배웁니다. 커머스 현업에서 가장 많이 쓰이는 필수 문법들입니다.

---

## 1. SELECT & SELECT DISTINCT

데이터를 읽어오는 가장 기본적인 명령어입니다.

- **이게 뭐예요?**: 테이블에서 특정 컬럼의 데이터를 가져옵니다. `DISTINCT`는 중복된 값을 제거하고 '종류'만 보고 싶을 때 사용합니다.
- **문법**:

    ```sql
    SELECT 컬럼1, 컬럼2 FROM 테이블명;
    SELECT DISTINCT 컬럼1 FROM 테이블명;
    ```

- **기본 예제**:

    ```sql
    -- 모든 회원의 이름을 가져옵니다.
    SELECT name FROM users;
    ```

- **실무 활용 (커머스)**: **"입점한 브랜드 종류 확인"**
  - **왜 쓰는가?**: 우리 쇼핑몰에 상품이 100만 개 있어도, `DISTINCT`를 쓰면 입점한 브랜드가 총 몇 종류인지 한눈에 알 수 있습니다.
  - **예시**: `SELECT DISTINCT brand_id FROM products;`

---

## 2. WHERE (조건 필터링)

원하는 데이터만 골라내기 위한 필터입니다.

- **이게 뭐예요?**: 특정 조건을 만족하는 데이터만 추출합니다. AND, OR, NOT으로 조건을 조합합니다.
- **문법**:

    ```sql
    SELECT * FROM 테이블명 WHERE 조건1 AND 조건2;
    ```

- **기본 예제**:

    ```sql
    -- 나이가 20살인 회원만 찾기
    SELECT * FROM users WHERE age = 20;
    ```

- **실무 활용 (커머스)**: **"고액 주문 건 필터링"**
  - **왜 쓰는가?**: 마케팅 팀에서 '5만 원 이상 결제한 사람'에게만 쿠폰을 보내고 싶을 때, 특정 금액 이상의 실적만 뽑아내기 위해 사용합니다.
  - **예시**: `SELECT * FROM orders WHERE total_amount >= 50000 AND status = 'COMPLETED';`

---

## 3. ORDER BY (정렬)

데이터의 순서를 정합니다.

- **이게 뭐예요?**: 특정 컬럼을 기준으로 데이터를 오름차순(`ASC`)이나 내림차순(`DESC`) 정렬합니다.
- **문법**:

    ```sql
    SELECT * FROM 테이블명 ORDER BY 컬럼명 [ASC|DESC];
    ```

- **기본 예제**:

    ```sql
    -- 이름순(가나다순)으로 정렬
    SELECT * FROM users ORDER BY name ASC;
    ```

- **실무 활용 (커머스)**: **"최신 주문순 정렬"**
  - **왜 쓰는가?**: 배송팀은 가장 최근에 들어온 주문을 먼저 처리해야 합니다. 날짜 컬럼을 기준으로 내림차순 정렬하여 최신순 리스트를 만듭니다.
  - **예시**: `SELECT * FROM orders ORDER BY order_date DESC;`

---

## 4. LIMIT / TOP (개수 제한)

결과물 중 상위 몇 개만 가져옵니다.

- **이게 뭐예요?**: 수많은 데이터 중 필요한 만큼만 끊어서 가져옵니다.
- **문법**:

    ```sql
    -- MySQL/PostgreSQL
    SELECT * FROM 테이블명 LIMIT 개수;
    ```

- **기본 예제**:

    ```sql
    -- 딱 3명만 가져오기
    SELECT * FROM users LIMIT 3;
    ```

- **실무 활용 (커머스)**: **"인기 상품 TOP 10 노출"**
  - **왜 쓰는가?**: 쇼핑몰 메인 페이지에 수만 개의 상품을 다 보여줄 수 없습니다. 판매량순으로 정렬한 뒤 `LIMIT 10`을 걸어 베스트 상품만 노출합니다.
  - **예시**: `SELECT * FROM products ORDER BY sales_count DESC LIMIT 10;`
