# Physical AI 학습 인덱스

> **대전제**: Physical AI는 디지털 세계에만 존재하던 AI가 물리 세계와 직접 상호작용하는 패러다임이다.
> 언어 모델(LLM)이 텍스트를 이해하듯, Physical AI는 카메라·센서·로봇 팔로 실제 세계를 인식하고 행동한다.
> 이 인덱스는 "개념 이해"에서 출발해 "실제 시스템 구현"까지의 학습 경로를 정의한다.

---

## 왜 Physical AI인가?

```
1세대 AI: 데이터 분류, 패턴 인식 (이미지 분류, 스팸 필터)
2세대 AI: 언어 이해, 생성 (LLM, ChatGPT)
3세대 AI: 물리 세계 행동 (로봇, 자율주행, 드론, 산업 자동화)
```

Physical AI의 핵심 과제는 **Perception → Reasoning → Action** 루프다.
센서로 세계를 인식하고, 추론하고, 물리적 행동을 결정한다.

---

## 학습 맵 — 전체 구조

```
┌─────────────────────────────────────────────────────┐
│                   Physical AI                        │
│                                                     │
│  ┌───────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ Perception │  │ Reasoning  │  │    Action     │  │
│  │ 세계 인식   │  │ 상황 추론   │  │  행동 결정    │  │
│  └─────┬─────┘  └─────┬──────┘  └──────┬────────┘  │
│        │              │                │            │
│  카메라/LiDAR     Foundation      모터/액추에이터    │
│  깊이 센서         Models            경로 계획       │
│  IMU/촉각        World Models       조작(Manipulation)│
└─────────────────────────────────────────────────────┘
```

---

## 1. 대전제 — Physical AI 개론

### AI의 물리 세계 확장
- Embodied AI vs Disembodied AI — 몸을 가진 AI의 의미
- Sim-to-Real Gap — 시뮬레이션 학습이 현실에서 실패하는 이유
- The Bitter Lesson — 범용 학습 알고리즘이 특수 설계를 이긴다
- Moravec's Paradox — 어른에게 쉬운 것이 AI에게 어렵다

### Physical AI의 응용 분야
- 산업용 로봇 팔 (제조, 물류, 조립)
- 모바일 로봇 (자율주행 차, AGV, 드론)
- 서비스 로봇 (가정용, 의료, 접객)
- 웨어러블 / 보조 기기 (외골격, 의수)
- 마이크로 로봇 (수술, 나노봇)

### 현재 기술 수준과 한계
- 오픈 월드 문제 (예상치 못한 상황 처리)
- 에너지 효율 (배터리 제약)
- 안전성 보장 (Formal Verification)
- 비용 구조 (센서, 액추에이터, 컴퓨팅)

---

## 2. Perception — 세계 인식

### 컴퓨터 비전 기초
- CNN에서 Vision Transformer(ViT)까지
- Object Detection: YOLO, DETR, RT-DETR
- Instance Segmentation: Mask R-CNN, SAM (Segment Anything)
- Optical Flow — 움직임 추정
- Stereo Vision & Depth Estimation

### 3D 인식
- Point Cloud 처리 — PointNet, PointNet++
- LiDAR 데이터 처리
- RGB-D (깊이 카메라) — Intel RealSense, Kinect
- NeRF (Neural Radiance Field) — 3D 장면 재구성
- Gaussian Splatting — 실시간 3D 표현

### 멀티모달 인식
- Vision-Language Models (CLIP, LLaVA, GPT-4V)
- 촉각 센서 + 비전 융합
- IMU + 비전 융합 (VIO — Visual-Inertial Odometry)
- 음향 센서 통합

### 환경 매핑
- SLAM (Simultaneous Localization and Mapping)
  - EKF-SLAM, Particle Filter SLAM
  - ORB-SLAM3, LIO-SAM
- Occupancy Grid Map
- Semantic Map — 의미 있는 물체 지도
- Topological Map

---

## 3. Reasoning — 상황 추론과 계획

### Foundation Models의 물리 세계 적용
- LLM as Planner — 언어 모델로 작업 계획 수립
- Vision-Language-Action (VLA) Models
  - RT-2 (Robotics Transformer 2, Google DeepMind)
  - OpenVLA, π0 (Physical Intelligence)
- Chain-of-Thought를 로봇 행동에 적용

### World Models
- World Model이란? — 환경의 내부 모델
- Dreamer, TDMPC — 모델 기반 강화학습
- Genie (Google) — 인터랙티브 환경 생성
- DIAMOND — 비디오 게임 → 실제 세계

### 공간 추론 (Spatial Reasoning)
- 3D 공간 이해 — 위치, 방향, 거리
- 물체 관계 추론 (위에, 옆에, 안에)
- 물리 시뮬레이션 기반 추론
- Affordance 학습 — 물체의 행동 가능성 이해

### 작업 계획 (Task Planning)
- PDDL (Planning Domain Definition Language)
- Hierarchical Task Networks (HTN)
- LLM + PDDL 하이브리드
- SayCan — LLM + Affordance 조합

---

## 4. Action — 행동 생성과 제어

### 모터 제어 기초
- PID 제어 — 비례, 적분, 미분
- 상태 공간 표현
- 모델 예측 제어 (MPC)
- 임피던스 제어 (힘/위치 조합)

### 경로 계획 (Motion Planning)
- Configuration Space (C-Space) 개념
- RRT, RRT* — 랜덤 트리 탐색
- PRM — 확률적 로드맵
- 포텐셜 필드 방법
- MoveIt! (ROS 기반 모션 플래닝)

### 조작 (Manipulation)
- 그리퍼 설계 — 평행 그리퍼, 다지 핸드
- Grasp Planning — 물체를 어떻게 잡을 것인가
  - GraspNet, Contact-GraspNet
- Dexterous Manipulation — 손가락 조작
- Deformable Object Manipulation (천, 케이블)

### 이동 (Locomotion)
- 바퀴형 이동 — 차동 구동, 홀로노믹
- 관절형 이동 — 보행 로봇 (Spot, Atlas)
- 드론 — 쿼드로터 역학, 자율 비행
- 수중 로봇 — AUV

---

## 5. 학습 방법론

### 모방 학습 (Imitation Learning)
- Behavioral Cloning (BC) — 사람 시연 직접 복제
- DAgger — 온라인 데이터 수집
- GAIL — 생성적 적대적 모방 학습
- Diffusion Policy — 확산 모델 기반 행동 생성

### 강화학습 (Reinforcement Learning)
- MDP 기초 — 상태, 행동, 보상, 전이
- 정책 경사법 — PPO, SAC, TD3
- 모델 기반 RL vs 모델 프리 RL
- 희소 보상 문제 (Sparse Reward)
- Curriculum Learning — 단계적 난이도 증가

### 시뮬레이션 학습
- Isaac Sim (NVIDIA) — GPU 가속 물리 시뮬레이션
- MuJoCo — 접촉 역학 시뮬레이션
- Gazebo + ROS
- Domain Randomization — Sim-to-Real 브릿지
- 합성 데이터 생성

### 데이터 수집과 관리
- 텔레오퍼레이션 — 사람이 로봇을 원격 조종
- Action Chunking — 연속 행동을 청크로 묶기
- 대규모 로봇 데이터셋 (Open X-Embodiment)
- 데이터 증강 기법

---

## 6. 핵심 아키텍처와 모델

### Vision-Language-Action (VLA)
- RT-1, RT-2 — Transformer 기반 로봇 정책
- OpenVLA — 오픈소스 VLA
- π0 (pi-zero) — Physical Intelligence
- Octo — 범용 로봇 정책

### Diffusion 기반 정책
- Diffusion Policy — 확산 모델로 행동 분포 학습
- 행동의 다중 모드성(Multimodality) 처리
- 3D Diffusion Policy

### Transformer 기반 제어
- ACT (Action Chunking with Transformers)
- Perceiver IO — 다양한 입출력 처리
- Gato (DeepMind) — 범용 에이전트

---

## 7. 하드웨어와 인프라

### 센서
- 카메라: RGB, 깊이(ToF, 구조광), 이벤트 카메라
- LiDAR: 회전형, 솔리드스테이트
- IMU: 가속도계, 자이로스코프
- 촉각 센서: GelSight, DIGIT
- 힘/토크 센서

### 액추에이터
- 서보모터 vs BLDC vs 유압식
- 시리즈 탄성 액추에이터 (SEA) — 안전성
- 소프트 액추에이터 — 공압, 형상기억합금
- 토크 밀도 vs 에너지 효율

### 컴퓨팅
- 엣지 AI 칩: NVIDIA Jetson, Google Coral
- 실시간 OS (RTOS) 요구사항
- ROS 2 — 로봇 운영 체제
- 클라우드-엣지 하이브리드 아키텍처

---

## 8. 안전성과 윤리

### 기술적 안전
- 안전 제약 강화학습 (Safe RL)
- 런타임 모니터링 — 이상 감지
- Fail-Safe 메커니즘
- Formal Verification — 행동 보장

### 사회적 영향
- 자동화로 인한 노동 시장 변화
- 책임 소재 — 로봇 사고 시 누가 책임지는가
- 자율 무기 시스템 윤리
- 프라이버시 — 상시 관찰 로봇

---

## 9. 최신 연구 동향과 회사

### 선도 연구 기관
- Physical Intelligence (π) — Sergey Levine 설립
- DeepMind Robotics — 알파폴드 팀 DNA
- Stanford IRIS, Berkeley RAIL
- Carnegie Mellon RI (Robotics Institute)
- MIT CSAIL

### 산업계
- Boston Dynamics (Spot, Atlas, Stretch)
- Figure AI — 범용 휴머노이드
- 1X Technologies — NEO
- Agility Robotics — Digit
- NVIDIA Isaac — 시뮬레이션 플랫폼

### 주목할 논문/프로젝트
- Open X-Embodiment — 범용 로봇 데이터셋
- RoboAgent — 적은 데이터로 범용 조작
- SpatialBot, SpatialVLA — 공간 이해 강화
- HumanPlus — 사람 동작 모방

---

## 학습 로드맵 (권장 순서)

```
기초 (3개월)
├── Python + NumPy + PyTorch 숙달
├── 컴퓨터 비전 기초 (CNN, ViT)
├── 강화학습 기초 (OpenAI Gym, MuJoCo)
└── ROS 2 기초

중급 (3개월)
├── SLAM 구현
├── 모방 학습 (Behavioral Cloning)
├── Diffusion Policy 이해 및 실습
└── Isaac Sim 환경 구축

고급 (6개월)
├── VLA 모델 파인튜닝
├── Sim-to-Real 실험
├── 실제 하드웨어 연동
└── 연구 논문 재현
```
