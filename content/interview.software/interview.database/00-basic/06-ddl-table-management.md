# 데이터 정의와 제약 조건 (DDL)

데이터를 담을 '그릇'인 테이블을 설계하고 규칙을 정하는 법을 배웁니다.

---

## 1. CREATE TABLE (테이블 생성)

데이터를 저장할 새로운 테이블을 만듭니다.

- **이게 뭐예요?**: 컬럼의 이름과 데이터 타입을 정의하여 표 형태의 저장소를 만듭니다.
- **문법**:

    ```sql
    CREATE TABLE 테이블명 (컬럼1 타입 제약조건, 컬럼2 타입);
    ```

- **기본 예제**:

    ```sql
    -- 간단한 메모장 테이블 만들기
    CREATE TABLE memo (id INT PRIMARY KEY, content VARCHAR(255));
    ```

- **실무 활용 (커머스)**: **"신규 이벤트 로깅"**
  - **왜 쓰는가?**: "여름 맞이 룰렛 이벤트"를 새로 기획했을 때, 누가 언제 어떤 경품을 받았는지 기록하기 위한 새로운 데이터 저장 공간이 필요합니다.
  - **예시**: `CREATE TABLE event_logs (log_id INT AUTO_INCREMENT, user_id VARCHAR(50), reward VARCHAR(100));`

---

## 2. Constraints (제약 조건)

데이터가 어긋나지 않도록 규칙을 세웁니다.

- **이게 뭐예요?**:
  - `PRIMARY KEY`: 중복 안 되고 비어있을 수 없는 고유 아이디
  - `NOT NULL`: 필수 입력값
  - `FOREIGN KEY`: 다른 테이블의 정보를 참조하는 연결고리
- **문법**:

    ```sql
    CREATE TABLE 테이블명 (id INT PRIMARY KEY, email VARCHAR(100) NOT NULL);
    ```

- **실무 활용 (커머스)**: **"회원 필수 정보 강제"**
  - **왜 쓰는가?**: 회원 가입 시 이메일이나 아이디가 없으면 배송이나 로그인이 안 됩니다. DB 레벨에서 `NOT NULL`을 걸어 아예 잘못된 데이터가 못 들어오게 막습니다.

---

## 3. ALTER / DROP (구조 변경 및 삭제)

만들어진 테이블을 고치거나 지웁니다.

- **이게 뭐예요?**: `ALTER`는 컬럼을 추가/수정할 때, `DROP`은 테이블을 통째로 삭제할 때 사용합니다.
- **문법**:

    ```sql
    ALTER TABLE 테이블명 ADD 컬럼명 타입;
    DROP TABLE 테이블명;
    ```

- **기본 예제**:

    ```sql
    -- 나이 컬럼 추가하기
    ALTER TABLE users ADD age INT;
    ```

- **실무 활용 (커머스)**: **"기능 확장에 따른 데이터 추가"**
  - **왜 쓰는가?**: 원래는 없었지만, 서비스 도중에 '무료배송 여부'를 상품 테이블에 추가해야 할 때 기존 데이터를 유지하면서 칸(컬럼)만 하나 늘립니다.
  - **예시**: `ALTER TABLE products ADD is_free_shipping BOOLEAN DEFAULT FALSE;`

---

## 4. INDEX (인덱스)

데이터를 찾는 속도를 획기적으로 높입니다.

- **이게 뭐예요?**: 책의 맨 뒤에 있는 '찾아보기'와 같습니다. 특정 컬럼에 인덱스를 걸면 검색 속도가 수백 배 빨라집니다.
- **문법**:

    ```sql
    CREATE INDEX 인덱스명 ON 테이블명(컬럼명);
    ```

- **기본 예제**:

    ```sql
    -- 이름으로 자주 검색한다면 이름에 인덱스 걸기
    CREATE INDEX idx_user_name ON users(name);
    ```

- **실무 활용 (커머스)**: **"전화번호로 회원 조회 속도 개선"**
  - **왜 쓰는가?**: 회원이 1,000만 명인데 전화번호로 검색하면 한참 걸립니다. 이때 전화번호에 인덱스를 걸면 0.01초 만에 해당 회원을 찾을 수 있습니다.
  - **예시**: `CREATE INDEX idx_phone_number ON customers(phone_number);`
