# 조인과 집합 (Joins & Sets)

여러 테이블에 나뉘어 있는 정보를 연결하여 하나의 큰 그림을 만드는 방법입니다. 데이터베이스 설계의 꽃이라 불리는 과정입니다.

---

## 1. INNER JOIN (내부 조인)

양쪽 테이블에 모두 일치하는 정보가 있는 경우만 합칩니다.

- **이게 뭐예요?**: 두 테이블의 공통 분모(교집합)만 가져옵니다.
- **문법**:

    ```sql
    SELECT * FROM 테이블A JOIN 테이블B ON 테이블A.ID = 테이블B.ID;
    ```

- **기본 예제**:

    ```sql
    -- 이름과 나이를 매칭하여 가져오기
    SELECT u.name, d.dept_name FROM users u JOIN departments d ON u.dept_id = d.id;
    ```

- **실무 활용 (커머스)**: **"주문 내역과 유저 정보 합치기"**
  - **왜 쓰는가?**: 주문 테이블에는 유저 ID만 있습니다. 실제 배송을 하려면 유저 테이블을 JOIN하여 회원의 이름과 연락처를 알아내야 합니다.
  - **예시**: `SELECT o.id, u.name FROM orders o JOIN users u ON o.user_id = u.id;`

---

## 2. LEFT (OUTER) JOIN (외부 조인)

왼쪽 테이블의 모든 정보를 가져오고, 오른쪽 테이블 정보는 없으면 NULL로 채웁니다.

- **이게 뭐예요?**: 왼쪽 데이터는 무조건 살리고, 오른쪽은 보조적으로 붙이는 방식입니다.
- **문법**:

    ```sql
    SELECT * FROM 테이블A LEFT JOIN 테이블B ON 테이블A.ID = 테이블B.ID;
    ```

- **기본 예제**:

    ```sql
    -- 모든 직원을 가져오되, 부서가 없는 직원도 포함하기
    SELECT e.name, d.dept_name FROM employees e LEFT JOIN departments d ON e.dept_id = d.id;
    ```

- **실무 활용 (커머스)**: **"주문 이력이 없는 유저 포함 조회"**
  - **왜 쓰는가?**: '모든 회원' 리스트를 뽑으면서, 각각 몇 번 주문했는지 알고 싶을 때 씁니다. 만약 `INNER JOIN`을 쓰면 주문 안 한 회원은 누락되지만, `LEFT JOIN`을 쓰면 주문 수 0회로 모든 회원이 보입니다.
  - **예시**: `SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.name;`

---

## 3. SELF JOIN (자체 조인)

자기 자신의 테이블을 다시 조인합니다.

- **이게 뭐예요?**: 하나의 테이블 안에 부모-자식 관계가 있을 때, 이를 연결하기 위해 사용합니다.
- **문법**:

    ```sql
    SELECT a.컬럼, b.컬럼 FROM 테이블 a, 테이블 b WHERE a.연결고리 = b.ID;
    ```

- **기본 예제**:

    ```sql
    -- 직원별 매니저 이름 찾기 (직원 테이블 안에 매니저 ID가 있는 경우)
    SELECT e1.name AS 직원, e2.name AS 매니저 FROM employees e1 JOIN employees e2 ON e1.manager_id = e2.id;
    ```

- **실무 활용 (커머스)**: **"대분류-소분류 카테고리 조회"**
  - **왜 쓰는가?**: 쇼핑몰 카테고리 테이블 하나에는 '패션(부모)'과 '운동화(자식)'가 섞여 있습니다. 이 테이블을 스스로 조인하여 "패션 > 운동화"라는 계층 구조를 한 줄로 표현할 때 씁니다.
  - **예시**: `SELECT p.name AS 대분류, c.name AS 소분류 FROM categories p JOIN categories c ON c.parent_id = p.id;`

---

## 4. UNION & UNION ALL (합집합)

결과물 두 개를 위아래로 이어 붙입니다.

- **이게 뭐예요?**: 서로 다른 조회 결과를 하나의 표로 만듭니다. `UNION`은 중복을 제거하고, `UNION ALL`은 전부 보여줍니다.
- **문법**:

    ```sql
    SELECT 컬럼 FROM 테이블A UNION SELECT 컬럼 FROM 테이블B;
    ```

- **기본 예제**:

    ```sql
    -- 사과 리스트와 바나나 리스트를 하나로 합치기
    SELECT name FROM apples UNION ALL SELECT name FROM bananas;
    ```

- **실무 활용 (커머스)**: **"통합 검색 결과 생성"**
  - **왜 쓰는가?**: 검색창에 검색어를 쳤을 때, '상품명'에서 찾은 결과와 '브랜드명'에서 찾은 결과를 한 줄로 합쳐서 한꺼번에 보여주고 싶을 때 사용합니다.
  - **예시**: `SELECT name FROM products WHERE name LIKE '%워치%' UNION SELECT name FROM brands WHERE name LIKE '%워치%';`
