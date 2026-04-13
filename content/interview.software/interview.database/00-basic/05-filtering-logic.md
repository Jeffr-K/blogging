# 유연한 필터링과 조건 로직

정교한 검색 조건과 비즈니스 로직을 쿼리에 녹이는 법을 배우는 아티클입니다.

---

## 1. LIKE & Wildcards (패턴 검색)

부분 검색을 수행합니다.

- **이게 뭐예요?**: 특정 문자가 포함되어 있는지 검색할 때 `%`와 `_` 기호를 사용합니다. (`%`는 여러 글자, `_`는 한 글자)
- **문법**:

    ```sql
    SELECT * FROM 테이블명 WHERE 컬럼 LIKE '%검색어%';
    ```

- **기본 예제**:

    ```sql
    -- '김'씨 성을 가진 회원 찾기
    SELECT * FROM users WHERE name LIKE '김%';
    ```

- **실무 활용 (커머스)**: **"키워드 검색 기능"**
  - **왜 쓰는가?**: 고객이 검색창에 '운동화'라고 쳤을 때, 상품명에 '운동화'가 어디에 있든(나이키 운동화, 운동화 끈 등) 결과에 노출하기 위해 양옆에 `%`를 붙여 검색합니다.
  - **예시**: `SELECT * FROM products WHERE name LIKE '%운동화%';`

---

## 2. IN / BETWEEN (범위 검색)

여러 값이나 특정 범위를 필터링합니다.

- **이게 뭐예요?**: `IN`은 "이 중 하나라도 맞으면", `BETWEEN`은 "이 사이 값이라면"을 의미합니다.
- **문법**:

    ```sql
    WHERE 컬럼 IN (값1, 값2);
    WHERE 컬럼 BETWEEN 시작 AND 끝;
    ```

- **기본 예제**:

    ```sql
    -- 1번, 3번 회원만 조회
    SELECT * FROM users WHERE id IN (1, 3);
    ```

- **실무 활용 (커머스)**: **"필터링 기능 (가격대/카테고리)"**
  - **왜 쓰는가?**: '의류'와 '잡화' 카테고리만 보고 싶거나, '1만 원부터 3만 원 사이' 상품만 보고 싶을 때 유용합니다.
  - **예시**: `SELECT * FROM products WHERE category IN ('의류', '잡화') AND price BETWEEN 10000 AND 30000;`

---

## 3. CASE (조건문)

쿼리 결과에 '만약에~'라는 로직을 넣습니다.

- **이게 뭐예요?**: 프로그래밍의 `if-else`와 같습니다. 값에 따라 다른 라벨을 붙여줍니다.
- **문법**:

    ```sql
    SELECT CASE WHEN 조건 THEN 결과 ELSE 그외결과 END FROM 테이블명;
    ```

- **기본 예제**:

    ```sql
    -- 20살 이상이면 성인, 아니면 미성년자 표시
    SELECT name, CASE WHEN age >= 20 THEN '성인' ELSE '미성년자' END AS age_group FROM users;
    ```

- **실무 활용 (커머스)**: **"회원 등급 라벨링"**
  - **왜 쓰는가?**: DB에는 구매 금액 숫자만 있습니다. 하지만 리포트를 뽑을 때는 금액에 따라 'VIP', 'GOLD' 같은 등급을 매겨서 분석해야 할 때 사용합니다.
  - **예시**: `SELECT user_id, CASE WHEN total_spent >= 1000000 THEN 'VIP' ELSE '일반' END AS grade FROM customers;`

---

## 4. Null Functions (COALESCE, ISNULL)

비어있는 데이터(`NULL`)를 처리합니다.

- **이게 뭐예요?**: 데이터가 없을 때 기본값을 대신 넣어줍니다.
- **문법**:

    ```sql
    -- NULL이면 대체값 반환
    SELECT COALESCE(컬럼, 대체값) FROM 테이블명;
    ```

- **기본 예제**:

    ```sql
    -- 별명이 없으면 '익명'으로 표시
    SELECT COALESCE(nickname, '익명') FROM users;
    ```

- **실무 활용 (커머스)**: **"미입력 정보 처리"**
  - **왜 쓰는가?**: 추천인 아이디가 비어있을 때 그대로 보여주면 시스템이 에러를 내거나 빈칸으로 나옵니다. 이때 '없음'이나 '기본값'으로 처리하여 UI/UX를 깔끔하게 만듭니다.
  - **예시**: `SELECT product_id, COALESCE(discount_rate, 0) as discount FROM products;`
