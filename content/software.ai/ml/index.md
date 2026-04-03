# Machine Learning 완전 학습 인덱스

> **대전제**: 머신러닝은 "규칙을 직접 코딩하는 대신, 데이터로부터 규칙을 학습하는" 패러다임이다.
> 이 인덱스는 수학적 기초부터 실무 ML 시스템 설계까지의 경로를 정의한다.
> 딥러닝은 ML의 부분집합이지만, 별도 인덱스(DL)에서 깊이 다룬다.

---

## 왜 ML을 이해해야 하는가

```
규칙 기반: 개발자가 if/else로 모든 경우를 정의
머신러닝: 데이터에서 패턴을 찾아 스스로 규칙을 학습

ML이 필요한 순간:
  - 규칙이 너무 복잡해서 손으로 쓸 수 없을 때
  - 데이터가 시간에 따라 변할 때
  - 규칙이 명시적이지 않지만 예시는 많을 때
```

---

## 학습 맵 — 전체 구조

| 기초 | 핵심 알고리즘 | 실무 |
|---|---|---|
| 수학 기초 | 지도학습 알고리즘 | 특성 엔지니어링 |
| 데이터 이해 | 비지도학습 | 모델 선택/평가 |
| 통계적 사고 | 앙상블 | MLOps |
| | 최적화 | 시스템 설계 |

---

## 1. 대전제 — ML 패러다임 이해

### ML의 세 가지 학습 유형
- **지도학습 (Supervised)** — 정답 레이블이 있는 데이터로 학습
  - 분류 (Classification) — 범주 예측
  - 회귀 (Regression) — 연속값 예측
- **비지도학습 (Unsupervised)** — 레이블 없이 패턴 발견
  - 군집화 (Clustering)
  - 차원 축소 (Dimensionality Reduction)
  - 이상 탐지 (Anomaly Detection)
- **강화학습 (Reinforcement Learning)** — 보상 신호로 행동 학습
  - 환경, 에이전트, 보상, 정책

### ML 프로젝트의 흐름
- 문제 정의 → 데이터 수집 → EDA → 전처리 → 모델링 → 평가 → 배포
- ML 프로젝트 실패 원인 톱 5
- 데이터 품질이 모델 품질보다 중요한 이유
- "No Free Lunch" 정리 — 모든 문제에 최적인 알고리즘은 없다

### ML vs 통계학 vs AI
- 통계학, ML, DL, AI의 관계도
- 빈도주의 vs 베이지안 관점
- 모수적 vs 비모수적 방법

---

## 2. 수학적 기초

### 선형대수
- 벡터, 행렬, 텐서 — 데이터 표현
- 행렬 곱셈 — 선형 변환 이해
- 고유값/고유벡터 — PCA의 수학적 기반
- 특이값 분해 (SVD)
- 행렬 분해와 추천 시스템

### 미적분과 최적화
- 미분과 편미분 — 기울기(Gradient) 이해
- 연쇄 법칙 (Chain Rule) — 역전파의 수학
- 경사 하강법 (Gradient Descent)
  - 배치 vs 미니배치 vs 확률적 경사 하강
- 볼록 최적화 vs 비볼록 최적화
- 라그랑지 승수법 — 제약 최적화 (SVM)

### 확률과 통계
- 확률 분포 — 이산, 연속 (정규, 베르누이, 포아송 등)
- 기댓값, 분산, 공분산
- 베이즈 정리 — P(A|B) = P(B|A)P(A)/P(B)
- 최대 가능도 추정 (MLE)
- 최대 사후 확률 추정 (MAP)
- 중심 극한 정리 — 샘플 크기와 분포

### 정보 이론
- 정보 엔트로피 — 불확실성의 측도
- 상호 정보 (Mutual Information) — 특성 중요도
- KL 발산 — 분포 간 거리
- 크로스 엔트로피 — 분류 손실 함수의 기반

---

## 3. 데이터 이해와 전처리

### 탐색적 데이터 분석 (EDA)
- 기술 통계 — 평균, 중앙값, 분산, 분위수
- 분포 시각화 — 히스토그램, KDE, Box Plot
- 상관관계 분석 — 피어슨, 스피어만
- 이상치(Outlier) 탐지 — IQR, Z-score
- 결측치 패턴 파악 — MCAR, MAR, MNAR

### 데이터 전처리
- 스케일링 — StandardScaler, MinMaxScaler, RobustScaler
- 범주형 인코딩 — One-Hot, Label, Target, Ordinal Encoding
- 결측치 처리 — 제거, 평균/중앙값/최빈값, KNN 대체
- 이상치 처리 — 제거, 클리핑, 변환
- 불균형 클래스 처리 — 오버샘플링(SMOTE), 언더샘플링, class_weight

### 특성 엔지니어링 (Feature Engineering)
- 도메인 지식 기반 특성 생성
- 다항 특성 (Polynomial Features)
- 날짜/시간 특성 분해
- 텍스트 특성 — TF-IDF, Count Vectorizer
- 상호작용 특성 (Interaction Features)
- 타깃 인코딩 (Target Encoding) — 리키지 주의

### 특성 선택 (Feature Selection)
- Filter 방법 — 분산, 상관계수, 카이제곱
- Wrapper 방법 — RFE (Recursive Feature Elimination)
- Embedded 방법 — Lasso, Tree 기반 중요도
- 차원의 저주와 특성 선택의 필요성

---

## 4. 지도학습 — 회귀

### 선형 회귀
- OLS (Ordinary Least Squares) — 최소제곱법
- 가정 검증 — 선형성, 독립성, 등분산성, 정규성
- 다중 공선성 (Multicollinearity) — VIF
- Ridge 회귀 — L2 정규화
- Lasso 회귀 — L1 정규화 (특성 선택 효과)
- ElasticNet — L1 + L2 결합

### 비선형 회귀
- 다항 회귀 (Polynomial Regression)
- 회귀 스플라인
- 가우시안 프로세스 회귀 (GPR) — 불확실성 추정

---

## 5. 지도학습 — 분류

### 로지스틱 회귀
- 시그모이드 함수와 확률 해석
- 결정 경계 (Decision Boundary)
- 소프트맥스 — 다중 클래스 확장
- 정규화 — C 파라미터

### 서포트 벡터 머신 (SVM)
- 마진 최대화 — 핵심 직관
- 커널 트릭 — 비선형 분류 (RBF, Polynomial)
- C 파라미터 — 마진 vs 오분류 트레이드오프
- SVR (Support Vector Regression)
- 대규모 데이터에서의 SVM 한계

### k-최근접 이웃 (k-NN)
- 게으른 학습 (Lazy Learning)
- k 선택 기준
- 거리 측도 — 유클리드, 맨해튼, 코사인
- 고차원에서의 성능 저하 — 차원의 저주

### 나이브 베이즈
- 조건부 독립 가정
- 가우시안/베르누이/다항 나이브 베이즈
- 텍스트 분류에서의 강점
- 영확률 문제 — 라플라스 스무딩

### 결정 트리 (Decision Tree)
- 분할 기준 — 지니 불순도, 정보 이득, 분산 감소
- 과적합 방지 — 가지치기 (Pre/Post Pruning)
- 트리 시각화와 해석 가능성
- 결정 트리의 불안정성

---

## 6. 앙상블 방법

### 앙상블의 수학적 기반
- 편향-분산 트레이드오프
  - 편향 ↑ → 과소적합, 분산 ↑ → 과적합
- 모델 오차의 상관관계와 앙상블 효과
- 약한 학습기 → 강한 학습기

### 배깅 (Bagging)
- 부트스트랩 샘플링 원리
- 랜덤 포레스트 (Random Forest)
  - 특성 랜덤 선택 — 다양성 확보
  - 특성 중요도 계산
  - OOB (Out-of-Bag) 평가
- Extra Trees

### 부스팅 (Boosting)
- AdaBoost — 오분류 샘플 가중치 증가
- Gradient Boosting — 잔차(Residual) 학습
- **XGBoost**
  - 2차 근사 최적화
  - 정규화 항 (L1/L2)
  - 병렬 트리 구축, 결측치 자동 처리
- **LightGBM**
  - Leaf-wise 트리 성장 (XGBoost는 Level-wise)
  - GOSS — 기울기 기반 단측 샘플링
  - EFB — 배타적 특성 묶음
- **CatBoost** — 범주형 특성 자동 처리

### 스태킹 (Stacking)
- 1단계 모델 → 2단계 메타 모델
- 홀드아웃 vs 교차 검증 기반 스태킹
- 블렌딩 vs 스태킹 차이

---

## 7. 비지도학습

### 군집화 (Clustering)
- **k-Means**
  - 알고리즘 단계와 수렴 조건
  - k 선택 — Elbow Method, 실루엣 점수
  - k-Means++ 초기화
  - 한계 — 구형 군집 가정, 이상치 민감
- **DBSCAN**
  - 밀도 기반 — 비구형 군집 처리
  - 이상치를 노이즈로 분류
  - eps, min_samples 파라미터
- **계층적 군집화**
  - 응집형 (Bottom-Up) vs 분열형 (Top-Down)
  - 덴드로그램 해석
  - 연결 기준 — 단일, 완전, 평균, 워드
- GMM (Gaussian Mixture Model) — 소프트 군집화

### 차원 축소 (Dimensionality Reduction)
- **PCA** — 분산 최대화 방향으로 투영, 설명 분산 비율
- **t-SNE** — 비선형, 시각화 전용, perplexity 파라미터
- **UMAP** — t-SNE보다 빠르고 전역 구조 보존
- **LDA** — 지도 차원 축소 (클래스 간 분산 최대화)
- Autoencoder — 딥러닝 기반 비선형 차원 축소

### 이상 탐지 (Anomaly Detection)
- 통계 기반 — Z-score, IQR
- Isolation Forest — 이상치 고립 용이성
- One-Class SVM
- LOF (Local Outlier Factor) — 밀도 기반
- Autoencoder 기반 — 재구성 오차

### 연관 규칙 학습
- Apriori 알고리즘 — 장바구니 분석
- 지지도(Support), 신뢰도(Confidence), 향상도(Lift)
- FP-Growth — Apriori보다 빠름

---

## 8. 모델 평가와 선택

### 교차 검증
- k-Fold CV, Stratified k-Fold, Leave-One-Out
- TimeSeriesSplit — 미래 데이터 누수 방지
- Nested CV — 하이퍼파라미터 최적화와 평가 분리

### 분류 평가 지표
- 혼동 행렬 (Confusion Matrix)
- 정밀도(Precision), 재현율(Recall), F1-Score
- ROC Curve & AUC — 임계값 독립적 평가
- PR Curve — 불균형 데이터에서 더 적합
- Log Loss — 확률 교정(Calibration) 평가

### 회귀 평가 지표
- MAE, MSE, RMSE, MAPE
- R² (결정계수)와 Adjusted R²
- 잔차 분석 — 패턴이 있으면 모델 가정 위반

### 과적합 진단과 해결
- 학습 곡선 (Learning Curve) 분석 — 편향 vs 분산 구별
- 정규화 — L1, L2, ElasticNet
- 조기 종료 (Early Stopping)

### 하이퍼파라미터 최적화
- Grid Search, Random Search
- Bayesian Optimization — Optuna, Hyperopt
- AutoML — Auto-sklearn, FLAML, H2O

---

## 9. 확률적 모델

### 베이지안 추론
- 사전 분포 → 가능도 → 사후 분포
- MCMC (Markov Chain Monte Carlo)
- 변분 추론 (Variational Inference)

### HMM (Hidden Markov Model)
- 시계열 상태 추정
- Viterbi 알고리즘, Baum-Welch 알고리즘

### 가우시안 프로세스
- 함수에 대한 사전 분포
- 커널 함수 선택
- 활용 — 베이지안 최적화, 불확실성 정량화

---

## 10. 시계열 분석

### 고전 시계열 모델
- 시계열 구성 요소 — 추세, 계절성, 잔차
- 정상성(Stationarity) — ADF 검정
- 자기상관 (ACF, PACF) 분석
- AR, MA, ARMA, ARIMA, SARIMA
- 지수 평활법 (Exponential Smoothing)

### ML 기반 시계열
- 시계열 → 지도학습 변환 — Lag Feature
- LightGBM/XGBoost for Time Series
- Feature Engineering — 이동 평균, 차분, 계절 특성
- Prophet (Meta) — 분해 기반 모델

---

## 11. 특화 분야

### 추천 시스템
- 협업 필터링 — 사용자 기반, 아이템 기반
- 행렬 분해 — SVD, ALS
- 콘텐츠 기반 필터링
- 하이브리드 추천, 콜드 스타트 문제

### 자연어 처리 (전통 ML)
- Bag of Words, TF-IDF, n-gram
- 나이브 베이즈 텍스트 분류
- LDA (Latent Dirichlet Allocation) — 토픽 모델링

---

## 12. 실무 ML 시스템

### 데이터 파이프라인
- 특성 저장소 (Feature Store) — Feast, Tecton
- 데이터 버전 관리 — DVC
- 데이터 품질 모니터링 — Great Expectations

### 모델 배포 패턴
- 배치 예측 vs 실시간 예측
- REST API 서빙 — FastAPI + 모델 로드
- 모델 직렬화 — Pickle, ONNX, joblib

### MLOps 기초
- 실험 추적 — MLflow, Weights & Biases
- 모델 레지스트리 — 버전 관리, 스테이지 관리
- 모델 모니터링 — 데이터 드리프트, 개념 드리프트
- A/B 테스트와 섀도우 배포

### 해석 가능성 (Interpretability)
- 전역 해석 — Feature Importance, PDP
- 지역 해석 — LIME, SHAP
- SHAP 값의 수학적 기반 (Shapley Value)

---

## 학습 로드맵

```
1단계 — 수학 기초 (1개월)
  Python + NumPy + Pandas 숙달
  선형대수, 확률/통계 복습

2단계 — 핵심 알고리즘 (2개월)
  scikit-learn으로 각 알고리즘 실습
  캐글 Titanic → Housing 데이터 도전

3단계 — 앙상블 마스터 (1개월)
  XGBoost, LightGBM 심화
  캐글 Tabular 대회 참여

4단계 — 평가와 MLOps (1개월)
  교차 검증, 하이퍼파라미터 최적화
  MLflow 실험 추적 환경 구축

5단계 — 실전 프로젝트 (지속)
  실제 데이터로 end-to-end 파이프라인 구축
```

## 추천 자료

- *The Elements of Statistical Learning* — Hastie et al. (무료 PDF)
- *Hands-On Machine Learning* — Aurélien Géron (가장 실용적)
- Stanford CS229 — Andrew Ng (무료 강의)
- fast.ai ML 강의 — 실용 중심
