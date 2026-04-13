---
title: "클라우드 벤더별 마이그레이션 솔루션"
author: jeffrey
date: 2026-04-13
tags: ["aws-dms", "gcp-dms", "azure-dms", "database-migration-service"]
---

## 클라우드 벤더별 마이그레이션 솔루션

현대의 데이터베이스 마이그레이션은 각 클라우드 사업자가 제공하는 지능형 관리 도구(DMS - Database Migration Service)들의 정교함에 달려 있습니다.

---

### 1. AWS DMS (AWS Database Migration Service)

가장 앞서가는 마이그레이션 서비스 중 하나로, 초기 복제와 스트리밍 방식의 CDC 기능을 하나의 솔루션으로 제공합니다.

- **AWS SCT (Schema Conversion Tool)**: 이기종 DB(Oracle -> PostgreSQL 등) 간 이전 시 데이터 타입과 SQL 구문을 자동으로 변환해 주는 별도의 강력한 도구입니다.
- **AWS Snowball 연동**: 데이터가 수십 TB 이상일 때, 네트워크 전송 대신 전용 스토리지 기기를 통한 대규모 오프라인 데이터 전입을 지원합니다.

### 2. GCP Database Migration Service

Google Cloud는 "최소한의 가동 중단 시간"에 초점을 맞춥니다.

- **서버리스 아키텍처**: 별도의 노출된 리스너 없이도 보안적으로 안전하게 외부 소스에서 Cloud SQL이나 AlloyDB로 데이터를 끌어옵니다.
- **Oracle to PostgreSQL 최적화**: 구글만의 내부 가이드를 통해 오라클의 복잡한 스키마를 오픈소스 환경에 최적화하여 안착시킵니다.

### 3. Azure Database Migration Service

Microsoft 기술 스택과의 완벽한 통합이 강점입니다.

- **SQL Server 특화**: 온프레미스의 SQL Server를 Azure SQL Database나 Azure SQL Managed Instance로 이전할 때 가장 높은 호환성과 최적화된 성능을 제공합니다.
- **ADS (Azure Data Studio) 확장**: 익숙한 GUI 도구 내에서 마이그레이션 과정을 시각화하고 진행 상황을 모니터링할 수 있습니다.

---

### 벤더사 공통: CDC(Change Data Capture)의 중요성

모든 DMS 서비스의 핵심은 원본 데이터베이스의 로그(MySQL: Binlog, PostgreSQL: WAL, Oracle: Redo)를 실시간으로 스트리밍하는 **CDC 기술**입니다. 이를 통해 초기 복제가 진행되는 수 시간 내지 수일 동안 발생하는 새로운 데이터를 타겟 DB에 끊임없이 동기화해주므로, 서비스의 최종 전환 시점(Cut-over)을 단 몇 초 이내로 줄일 수 있는 것입니다.

---

#### 결정 가이드

- **AWS**: 멀티 리전 대규모 서비스와 이기종 전환이 빈번한 환경.
- **GCP**: 오픈소스 데이터 인프라(MySQL, PostgreSQL)의 간편한 클라우드 이전.
- **Azure**: MS SQL Server 기반의 비즈니스 애플리케이션 현대화.

벤더사의 도구들을 충분히 활용하되, 각 도구의 **대역폭 제한(Throttling)**이나 **동시성(Parity)** 설정을 우리 서비스의 부하 감도에 맞게 미세 조정하는 것이 엔지니어의 핵심 역량입니다.
