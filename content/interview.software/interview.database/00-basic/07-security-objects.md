# 보안과 고급 객체 (Security & Objects)

데이터를 안전하게 보호하고, 복잡한 쿼리를 효율적으로 관리하는 방법입니다. 실무 개발자라면 반드시 알아야 할 보안 수칙과 운영 효율성을 높여주는 도구들을 살펴봅시다.

---

## 1. Prepared Statements (프리페어드 스테이트먼트)

SQL Injection 공격을 방어하기 위해 쿼리와 데이터를 분리하여 처리하는 방식입니다.

- **이게 뭔가요?**: 쿼리의 틀을 미리 만들어두고, 데이터만 나중에 갈아 끼우는 방식입니다. 해커가 쿼리 자체를 조작하는 것을 막아줍니다.
- **문법**: (보통 프로그래밍 언어와 함께 쓰입니다)

    ```sql
    -- 데이터를 바로 넣지 않고 ?(파라미터)로 비워둡니다.
    SELECT * FROM users WHERE user_id = ? AND password = ?;
    ```

- **간단 예제**:

    ```sql
    -- 실제 실행 시에는 ? 자리에 안전하게 데이터만 매핑됩니다.
    EXECUTE login_query USING 'user123', 'password123!';
    ```

- **실무 활용**: **"로그인이나 회원 정보 조회"**
  - **왜 쓰는가?**: 로그인 창에 `admin' OR '1'='1` 같은 악성 코드를 입력해도, 이를 명령어가 아닌 단순 '아이디 문자열'로 인식하게 하여 계정 탈취를 방지합니다.

---

## 2. Views (뷰)

복합하고 긴 쿼리를 마치 하나의 테이블처럼 이름 붙여 저장해둔 '가상 테이블'입니다.

- **이게 뭔가요?**: 실제 데이터를 갖고 있지는 않지만, 정의된 쿼리를 실행한 결과를 보여주는 창문과 같습니다.
- **문법**:

    ```sql
    CREATE VIEW view_name AS
    SELECT column1, column2 FROM table_name WHERE condition;
    ```

- **간단 예제**: 가격이 5만 원 이상인 상품만 보여주는 뷰 만들기

    ```sql
    CREATE VIEW high_price_products AS
    SELECT name, price FROM products WHERE price >= 50000;

    -- 이후에는 테이블처럼 조회 가능합니다.
    SELECT * FROM high_price_products;
    ```

- **실무 활용**: **"마케팅용 종합 정보 뷰"**
  - **왜 쓰는가?**: `주문 + 회원 + 배송` 3개 테이블을 조인하는 쿼리는 너무 길고 복잡합니다. 이를 `order_summary`라는 뷰로 만들어두면, SQL을 잘 모르는 마케터분들도 `SELECT * FROM order_summary`만으로 고도화된 데이터를 볼 수 있습니다.

---

## 3. Stored Procedures (저장 프로시저)

여러 개의 SQL 문을 하나의 함수처럼 묶어서 DB 서버에 저장해두고 실행하는 것입니다.

- **이게 뭔가요?**: 복잡한 비즈니스 로직(예: 결제 처리 = 주문 생성 + 재고 차감 + 포인트 적립)을 한 번에 실행하기 위해 사용합니다.
- **문법**:

    ```sql
    CREATE PROCEDURE procedure_name(parameters)
    BEGIN
        -- 여러 개의 SQL 문들
    END;
    ```

- **간단 예제**: 특정 상품의 재고를 0으로 만드는 프로시저

    ```sql
    CREATE PROCEDURE make_sold_out(p_id INT)
    BEGIN
        UPDATE products SET stock = 0 WHERE product_id = p_id;
    END;

    -- 실행할 때
    CALL make_sold_out(101);
    ```

- **실무 활용**: **"일일 정산 프로세스"**
  - **왜 쓰는가?**: 매일 밤 전날의 매출 데이터를 집계하고, 취소 건을 제외하고, 최종 정산 테이블에 값을 넣는 작업을 서버(Java, Python 등)에서 일일이 쿼리를 날리는 것보다, DB 서버 안에서 한 번에 처리하는 게 속도와 관리에 효율적입니다.

---

## 4. Hosting (호스팅)

데이터베이스가 실제로 설치되어 돌아가는 '장소'를 의미합니다.

- **이게 뭔가요?**: 엑셀 파일을 내 PC에 저장할지, 구글 드라이브에 올릴지 결정하는 것과 비슷합니다.
- **실무 환경**:
  - **AWS RDS, Google Cloud SQL**: 클라우드 회사가 DB 설치부터 업데이트, 백업까지 다 대신해주는 대중적인 방식입니다.
  - **On-premise (자체 서버)**: 보안이 극도로 중요한 금융권 등에서 회사 전산실에 직접 서버를 두고 관리하는 방식입니다.
- **왜 중요한가?**: 데이터가 많아지면 서버의 사양(CPU, 메모리)을 높이거나, 저장 공간을 늘리는 등의 호스팅 설정이 서비스 속도에 큰 영향을 미칩니다.
