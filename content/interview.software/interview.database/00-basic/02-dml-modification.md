# 데이터 변경 기초 (DML)

데이터를 추가하거나, 이미 있는 정보를 수정하고 삭제하는 방법을 배웁니다. 실시간으로 변하는 쇼핑몰 데이터를 관리하는 핵심 기술입니다.

---

## 1. INSERT INTO (데이터 추가)

새로운 정보를 데이터베이스에 저장합니다.

- **이게 뭐예요?**: 테이블에 새로운 행(Row)을 삽입합니다.
- **문법**:

    ```sql
    INSERT INTO 테이블명 (컬럼1, 컬럼2) VALUES (값1, 값2);
    ```

- **기본 예제**:

    ```sql
    -- 새로운 회원 한 명 추가
    INSERT INTO users (name, email) VALUES ('홍길동', 'hong@test.com');
    ```

- **실무 활용 (커머스)**: **"회원가입 서비스"**
  - **왜 쓰는가?**: 고객이 회원가입 양식을 다 쓰고 '가입 완료' 버튼을 누르는 순간, 서버는 이 명령어를 날려 고객 정보를 DB에 영구 저장합니다.
  - **예시**: `INSERT INTO users (user_id, signup_date) VALUES ('kim123', NOW());`

---

## 2. UPDATE (데이터 수정)

기존에 있던 정보를 바꿉니다.

- **이게 뭐예요?**: 특정 조건에 맞는 데이터의 값을 변경합니다. **주의: WHERE 절을 빠뜨리면 모든 데이터가 바뀌므로 주의해야 합니다.**
- **문법**:

    ```sql
    UPDATE 테이블명 SET 컬럼1 = 새값 WHERE 조건;
    ```

- **기본 예제**:

    ```sql
    -- 고길동의 나이를 40살로 수정
    UPDATE users SET age = 40 WHERE name = '고길동';
    ```

- **실무 활용 (커머스)**: **"주문 상태 변경 (배송 시작)"**
  - **왜 쓰는가?**: 창고에서 택배 송장을 뽑고 나면, 해당 주문의 상태를 '결제완료'에서 '배송중'으로 바꿔줘야 합니다.
  - **예시**: `UPDATE orders SET status = 'SHIPPING' WHERE order_id = 'ORD_20240413';`

---

## 3. DELETE (데이터 삭제)

불필요한 정보를 삭제합니다.

- **이게 뭐예요?**: 테이블에서 데이터를 삭제합니다. (실무에서는 실제로 지우지 않고 '삭제 여부' 컬럼만 수정하는 경우가 많습니다.)
- **문법**:

    ```sql
    DELETE FROM 테이블명 WHERE 조건;
    ```

- **기본 예제**:

    ```sql
    -- '퇴사자' 데이터 삭제
    DELETE FROM employees WHERE status = 'OUT';
    ```

- **실무 활용 (커머스)**: **"장바구니 아이템 삭제"**
  - **왜 쓰는가?**: 고객이 장바구니에 담았던 상품 옆의 'X' 버튼을 눌렀을 때, 담겨있던 정보를 DB에서 제거하기 위해 사용합니다.
  - **예시**: `DELETE FROM cart_items WHERE user_id = 'user1' AND product_id = 'P001';`

---

## 4. INSERT INTO SELECT (데이터 복사)

다른 테이블의 데이터를 통째로 복사해 옵니다.

- **이게 뭐예요?**: 조회(SELECT)한 결과를 바로 다른 테이블에 삽입(INSERT)합니다.
- **문법**:

    ```sql
    INSERT INTO 대상테이블 SELECT * FROM 원본테이블 WHERE 조건;
    ```

- **기본 예제**:

    ```sql
    -- 예전 회원 데이터를 백업 테이블로 복사
    INSERT INTO users_backup SELECT * FROM users WHERE signup_date < '2020-01-01';
    ```

- **실무 활용 (커머스)**: **"판매 종료 상품 아카이빙"**
  - **왜 쓰는가?**: 작년 시즌 오프 상품들을 운영 테이블에 두면 검색 속도가 느려지므로, 보관용 테이블로 옮기고 운영 테이블에서는 지울 때 사용합니다.
  - **예시**: `INSERT INTO products_old SELECT * FROM products WHERE sale_status = 'DISABLED';`
