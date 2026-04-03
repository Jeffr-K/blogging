# Robotics 학습 인덱스

> **대전제**: 로보틱스는 기계공학, 전자공학, 컴퓨터과학, AI가 교차하는 분야다.
> "로봇을 만들고 동작시키는 것"은 단순한 프로그래밍이 아니라 물리 세계의 제약(중력, 마찰, 관성)을
> 이해하고 제어하는 문제다. 이 인덱스는 소프트웨어 엔지니어가 로보틱스에 입문하는 경로를 정의한다.

---

## 왜 로보틱스인가?

```
소프트웨어 엔지니어의 관점에서:
  일반 소프트웨어 → 입력: 사용자 클릭/타이핑  출력: 화면
  로보틱스 소프트웨어 → 입력: 센서 스트림    출력: 모터 토크

차이점:
  - 실시간성 (ms 단위 제어 루프)
  - 물리 세계의 불확실성 (마찰, 노이즈, 예측 불가 장애물)
  - 안전 요구사항 (버그 = 물리적 피해 가능)
  - 하드웨어-소프트웨어 공동 설계
```

---

## 학습 맵 — 전체 구조

```
┌────────────────────────────────────────────────────────────┐
│                      Robotics Stack                        │
├────────────────────────────────────────────────────────────┤
│  Application Layer     작업 계획, HRI, 자율 임무               │
├────────────────────────────────────────────────────────────┤
│  AI / Perception Layer  비전, SLAM, 물체 인식, 행동 학습         │
├────────────────────────────────────────────────────────────┤
│  Middleware             ROS 2, DDS, 통신, 시뮬레이션           │
├────────────────────────────────────────────────────────────┤
│  Control Layer          PID, MPC, 역기구학, 모션 플래닝         │
├────────────────────────────────────────────────────────────┤
│  Hardware Layer         센서, 액추에이터, 임베디드 시스템          │
└────────────────────────────────────────────────────────────┘
```

---

## 1. 대전제 — 로보틱스 개론

### 로봇의 정의와 분류
- 로봇의 3요소: 인식(Sense) → 사고(Think) → 행동(Act)
- 산업용 로봇 vs 서비스 로봇 vs 협동 로봇(Cobot)
- 자유도(DOF — Degrees of Freedom) 개념
- 고정형 vs 이동형 vs 하이브리드

### 로보틱스 소프트웨어의 특수성
- Hard Real-Time vs Soft Real-Time 차이
- 결정론적 실행 보장의 중요성
- 센서-액추에이터 루프 지연(Latency) 허용치
- 하드웨어 추상화 계층(HAL)의 필요성

### 산업 표준과 생태계
- IEC 61131 — PLC 프로그래밍 표준
- ISO 10218 — 산업용 로봇 안전 규격
- ROS(Robot Operating System) 생태계
- AUTOSAR — 자동차 소프트웨어 아키텍처

---

## 2. 수학적 기초

### 선형대수
- 벡터와 행렬 — 위치, 방향 표현
- 회전 행렬 (3×3)
- 동차 변환 행렬 (4×4) — 위치 + 방향 통합 표현
- 특이값 분해 (SVD) — 역기구학에서 활용
- 최소제곱법 — 센서 캘리브레이션

### 3D 회전 표현
- 오일러 각도 (Euler Angles) — 짐벌락 문제
- 회전 행렬 (Rotation Matrix)
- 쿼터니언 (Quaternion) — 짐벌락 없는 표현
- 축-각도 표현 (Axis-Angle)
- 각 표현의 장단점과 상호 변환

### 미적분과 동역학
- 자코비안 (Jacobian) — 속도 변환
- 뉴턴-오일러 방법 — 역동역학
- 라그랑지안 역학 — 에너지 기반 모델링
- 리아프노프 안정성 — 제어 안정성 증명

### 확률과 통계
- 가우시안 분포 — 센서 노이즈 모델
- 베이즈 정리 — 상태 추정
- 칼만 필터 (KF, EKF, UKF)
- 파티클 필터 (입자 필터)
- 몬테카를로 방법

---

## 3. 로봇 기구학 (Kinematics)

### 순기구학 (Forward Kinematics)
- 링크와 조인트 — 로봇 팔의 구조
- DH 파라미터 (Denavit-Hartenberg) — 표준 표현법
- 변환 행렬 체이닝
- 6DOF 로봇 팔 FK 계산

### 역기구학 (Inverse Kinematics)
- 기하학적 IK — 해석적 풀이
- 수치적 IK — 야코비안 기반 반복 계산
  - 의사역행렬 (Pseudoinverse)
  - 댐핑 최소제곱법 (DLS)
- IK 솔버 라이브러리 — KDL, TRAC-IK, IKFast
- 특이점 (Singularity) — IK가 풀리지 않는 구성

### 미분 기구학
- 속도 기구학 (Velocity Kinematics)
- 자코비안 행렬 — 조인트 속도 → 엔드이펙터 속도
- 정적 힘 관계 — 힘/토크 변환
- 가속도 기구학

---

## 4. 로봇 동역학 (Dynamics)

### 강체 역학 기초
- 질량, 관성 텐서 (Inertia Tensor)
- 뉴턴의 운동법칙 3D 확장
- 각운동량 보존

### 로봇 동역학 방정식
- 운동 방정식: M(q)q̈ + C(q,q̇)q̇ + G(q) = τ
  - M: 관성 행렬
  - C: 코리올리/원심력 행렬
  - G: 중력 항
  - τ: 관절 토크
- 뉴턴-오일러 알고리즘 (재귀적)
- 라그랑지안 공식화

### 접촉 역학
- 마찰 모델 — 쿨롱 마찰, 점성 마찰
- 충격 역학 (Impact Dynamics)
- 그립 포스 분석
- 연성(Compliance) 모델링

---

## 5. 제어 이론

### 고전 제어
- 피드백 제어의 기본 구조
- PID 제어기 — 설계 및 튜닝
  - Ziegler-Nichols 방법
  - 자동 튜닝 (Auto-tuning)
- 주파수 응답 분석 — 보드 선도
- 안정성 판별 — 나이퀴스트, 보드 안정 여유

### 현대 제어
- 상태 공간 표현 (State Space)
- 상태 피드백 — 폴 배치
- LQR (Linear Quadratic Regulator) — 최적 제어
- 칼만 필터 + LQR = LQG
- 관측기 (Observer) 설계

### 모델 예측 제어 (MPC)
- MPC 기본 원리 — 반복 최적화
- 예측 지평(Prediction Horizon)
- 제약 처리 — 조인트 한계, 속도 한계
- 비선형 MPC (NMPC)
- 실시간 MPC 구현 (ACADO, CasADi)

### 힘/임피던스 제어
- 힘 제어 vs 위치 제어 트레이드오프
- 임피던스 제어 — 가상의 질량-스프링-댐퍼
- 어드미턴스 제어
- 하이브리드 힘-위치 제어
- 협동 로봇에서의 안전 접촉

---

## 6. 모션 플래닝 (Motion Planning)

### 탐색 기반 방법
- Configuration Space (C-Space) 개념
- 그리드 탐색 — A*, Dijkstra
- 포텐셜 필드 방법
  - 인력(목표) + 척력(장애물)
  - 지역 최솟값 문제

### 샘플링 기반 방법
- PRM (Probabilistic Roadmap Method)
- RRT (Rapidly-exploring Random Tree)
- RRT* — 점근적 최적
- Informed RRT* — 효율적 탐색
- 좁은 통로 문제 (Narrow Passage)

### 최적화 기반 방법
- Trajectory Optimization
  - CHOMP — 비용 함수 최적화
  - TrajOpt — 순차 볼록 최적화
- STOMP — 확률적 최적화
- 시간 최적 궤적 (Time-Optimal)

### 다중 로봇 계획
- 중앙화 vs 분산화 계획
- CBS (Conflict-Based Search)
- MAPF (Multi-Agent Path Finding)

---

## 7. 인식 (Perception)

### 센서 이론
- 센서 노이즈 모델 — 가우시안, 스파이크
- 센서 캘리브레이션 — 카메라 내부/외부 파라미터
- 시간 동기화 (Time Synchronization)
- 센서 퓨전 기초

### 카메라 기하학
- 핀홀 카메라 모델
- 렌즈 왜곡 보정
- 스테레오 카메라 — 삼각측량으로 깊이 추정
- RGB-D 카메라 동작 원리 (ToF, 구조광)

### 포인트 클라우드 처리
- 다운샘플링 — Voxel Grid, Farthest Point Sampling
- 노이즈 제거 — Statistical Outlier Removal
- 표면 추정 — 법선 벡터 계산
- ICP (Iterative Closest Point) — 정합(Registration)
- PCL (Point Cloud Library)

### SLAM
- EKF-SLAM — 확장 칼만 필터 기반
- FastSLAM — 파티클 필터 기반
- Graph-based SLAM — 포즈 그래프 최적화
  - g2o, GTSAM, Ceres
- 시각적 SLAM (Visual SLAM)
  - ORB-SLAM3, DROID-SLAM
- LiDAR SLAM
  - LOAM, LIO-SAM, KISS-ICP
- 루프 클로저 — 장소 재인식

---

## 8. ROS 2 (Robot Operating System)

### ROS 2 핵심 개념
- Node — 독립 프로세스 단위
- Topic (Publisher/Subscriber) — 비동기 데이터 스트림
- Service (Request/Response) — 동기 호출
- Action — 장기 실행 작업 (취소 가능)
- Parameter — 런타임 설정

### DDS (Data Distribution Service)
- ROS 2가 DDS를 쓰는 이유
- QoS 프로파일 — 신뢰성, 지연 시간, 대역폭
- 구현체 선택 — Fast DDS, Cyclone DDS
- 멀티캐스트 vs 유니캐스트

### 주요 ROS 2 패키지
- Nav2 — 자율 이동 (경로 계획, 장애물 회피)
- MoveIt 2 — 로봇 팔 모션 플래닝
- ros2_control — 하드웨어 추상화 및 제어기
- Gazebo Ignition (gz-sim) — 시뮬레이션
- rviz2 — 3D 시각화

### ROS 2 실전 개발
- 패키지 구조 및 빌드 (colcon, CMake, ament)
- 커스텀 메시지/서비스/액션 정의
- 라이프사이클 노드 — 관리되는 상태 기계
- 컴포지터블 노드 — 같은 프로세스 내 노드 조합
- 런치 파일 (Python Launch)
- 테스트 — 단위/통합/시스템 테스트

---

## 9. 시뮬레이션

### 물리 시뮬레이터 비교
- **MuJoCo** — 접촉 역학 정확, 빠름. 연구 표준.
- **Gazebo (gz-sim)** — ROS 통합, 오픈소스
- **NVIDIA Isaac Sim** — GPU 가속, 포토리얼
- **PyBullet** — Python 친화적, 경량
- **Webots** — 교육용, 무료

### 시뮬레이션 환경 구성
- 로봇 모델 — URDF, MJCF, SDF
- 물리 파라미터 설정 — 마찰, 탄성, 댐핑
- 센서 시뮬레이션 — 노이즈 추가
- 랜덤화 (Domain Randomization)
  - 조명, 텍스처, 물리 파라미터 무작위화
  - Sim-to-Real 갭 줄이기

### Sim-to-Real Transfer
- 갭의 원인 — 모델링 오류, 센서 불일치
- 도메인 랜덤화 전략
- 도메인 적응 — 적은 실제 데이터로 미세조정
- 시스템 식별 — 실제 시스템 파라미터 추정

---

## 10. 임베디드 시스템과 하드웨어

### 마이크로컨트롤러 vs SBC
- MCU (STM32, Arduino) — 실시간 제어
- SBC (Raspberry Pi, Jetson Nano) — 고수준 처리
- 역할 분리 패턴 — MCU(저수준 제어) + SBC(AI/ROS)

### 통신 프로토콜
- UART, SPI, I2C — 센서 인터페이스
- CAN Bus — 산업용 로봇 표준
- EtherCAT — 고속 실시간 이더넷
- USB, Ethernet — 상위 레벨 통신

### 전원 관리
- 배터리 기술 — LiPo, LiFePO4
- 전원 분배 회로
- 모터 드라이버 선택
- 소비 전력 최적화

### 실시간 OS
- RTOS 개념 — 선점형 스케줄링
- FreeRTOS, Zephyr
- Linux + PREEMPT_RT 패치
- Xenomai — 이중 커널 접근

---

## 11. 특화 분야

### 모바일 로봇 (Mobile Robotics)
- 비홀로노믹 제약 (차동 구동)
- 경로 추종 — Pure Pursuit, Stanley 컨트롤러
- 비용 맵 (Costmap) 생성
- 동적 장애물 회피 — DWA, TEB

### 드론 (UAV)
- 쿼드로터 역학 및 제어
- 비행 제어기 (FC) — PX4, ArduPilot
- GPS + 비전 융합 위치 추정
- 자율 비행 — 경로 계획, 장애물 회피
- MAVLink 프로토콜

### 로봇 팔 조작
- 작업 공간 분석
- 조작 가능성 (Manipulability)
- 충돌 검사 — FCL, Bullet
- 물체 파지 — GraspIt!, GPD
- 양팔 로봇 — 협력 작업

### 휴머노이드 로봇
- 전신 운동 제어 (Whole-Body Control)
- 균형 제어 — ZMP (Zero Moment Point), LIPM
- 보행 패턴 생성 — CPG, MPC
- 사람-로봇 상호작용

---

## 12. 안전과 표준

### 기능 안전 (Functional Safety)
- IEC 61508 — 전기/전자 안전 표준
- ISO 13849 — 기계 제어 시스템 안전
- SIL (Safety Integrity Level) 등급
- 안전 설계 패턴 — Fail-Safe, Watchdog

### 협동 로봇 안전
- ISO/TS 15066 — 협동 로봇 안전 규격
- 속도/힘 제한 (Power and Force Limiting)
- 안전 등급 I/O
- 위험 평가 프로세스

---

## 학습 로드맵 (소프트웨어 엔지니어 기준)

```
1단계 — 기초 수학/물리 (1~2개월)
  └── 선형대수, 쿼터니언, 칼만 필터 기초

2단계 — ROS 2 + 시뮬레이션 (1~2개월)
  └── ROS 2 기초, Gazebo 또는 MuJoCo 환경 구성

3단계 — 제어 이론 실습 (1~2개월)
  └── PID → LQR → MPC 구현 (시뮬레이션)

4단계 — 인식 파이프라인 (2개월)
  └── SLAM, 물체 감지, 포즈 추정

5단계 — 모션 플래닝 + 조작 (2개월)
  └── MoveIt 2, RRT, IK 솔버

6단계 — 실제 하드웨어 (지속)
  └── 저렴한 로봇 팔 또는 이동 로봇 플랫폼
      (Dynamixel 서보, TurtleBot4, Franka Emika)
```

## 추천 학습 자료

### 교재
- *Probabilistic Robotics* — Thrun, Burgard, Fox (SLAM 바이블)
- *Modern Robotics* — Lynch & Park (기구학/동역학, 무료 공개)
- *Robotics: Modelling, Planning and Control* — Siciliano et al.
- *Introduction to Autonomous Mobile Robots* — Siegwart et al.

### 온라인 강의
- Modern Robotics (Coursera, Northwestern)
- Robotics Specialization (Coursera, UPenn)
- MIT OpenCourseWare 6.832 (Underactuated Robotics)
- ETH Zurich Robotics 강의 (YouTube)

### 커뮤니티
- ROS Discourse — 공식 커뮤니티
- Robotics Stack Exchange
- r/robotics
- Open Robotics GitHub
