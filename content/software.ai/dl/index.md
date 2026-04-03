# Deep Learning 완전 학습 인덱스

> **대전제**: 딥러닝은 다층 신경망으로 데이터에서 계층적 표현을 자동으로 학습하는 방법이다.
> 이미지, 텍스트, 음성 등 비정형 데이터에서 인간 수준의 성능을 달성하며,
> 현대 AI의 대부분은 딥러닝 위에 서 있다.
> 이 인덱스는 퍼셉트론 기초부터 최신 Foundation Model까지의 경로를 정의한다.

---

## 왜 딥러닝인가

```
전통 ML:  특성 엔지니어링(사람) + 알고리즘(기계) → 예측
딥러닝:   원시 데이터(사람) + 신경망(기계) → 특성 + 예측

딥러닝이 지배하는 영역:
  - 이미지/비디오 인식, 생성
  - 자연어 처리, 번역, 생성
  - 음성 인식, 합성
  - 강화학습 (AlphaGo, ChatGPT)
```

---

## 학습 맵 — 전체 구조

| 기초 | 핵심 아키텍처 | 최신 모델 |
|---|---|---|
| 신경망 기초 | CNN (이미지) | Transformer |
| 역전파 | RNN/LSTM (시퀀스) | BERT, GPT |
| 최적화 | Attention | Diffusion Model |
| 정규화 | GAN | Multimodal |
| | Graph Neural Network | Foundation Model |

---

## 1. 대전제 — 딥러닝이란

### 딥러닝의 역사
- 퍼셉트론 (1958) → XOR 문제 → 암흑기
- 역전파 재발견 (1986, Rumelhart et al.)
- 두 번째 암흑기 → SVM의 시대
- AlexNet (2012) — 딥러닝 르네상스
- ResNet, Attention, Transformer, GPT-3, ChatGPT

### Bitter Lesson
- 범용 알고리즘 + 대규모 계산 + 대규모 데이터가 특수 설계를 이긴다
- 스케일 법칙 (Scaling Laws) — 더 크면 더 잘한다
- GPU 컴퓨팅의 역할

### 언제 딥러닝을 쓰는가
- 비정형 데이터 (이미지, 텍스트, 음성)
- 충분한 데이터가 있을 때 (수만 건 이상)
- 특성 엔지니어링이 어려울 때
- 전통 ML로 충분한 경우 딥러닝은 과잉

---

## 2. 신경망 기초

### 퍼셉트론과 다층 퍼셉트론 (MLP)
- 생물학적 뉴런 → 수학적 모델
- 선형 분류기로서의 퍼셉트론
- XOR 문제 — 단층 퍼셉트론의 한계
- 다층 퍼셉트론 (MLP) — 은닉층 추가
- 유니버설 근사 정리 (Universal Approximation Theorem)

### 활성화 함수 (Activation Functions)
- 시그모이드 (Sigmoid) — 기울기 소실 문제
- 하이퍼볼릭 탄젠트 (Tanh)
- **ReLU** — 딥러닝 혁명의 숨은 주역
  - 죽은 ReLU 문제 (Dying ReLU)
- Leaky ReLU, PReLU, ELU
- **GELU** — Transformer에서 표준
- **SwiGLU** — LLM에서 주로 사용
- Softmax — 다중 분류 출력층

### 손실 함수 (Loss Functions)
- MSE (Mean Squared Error) — 회귀
- Cross-Entropy — 분류
  - Binary Cross-Entropy
  - Categorical Cross-Entropy
- Focal Loss — 불균형 분류
- Triplet Loss — 메트릭 학습
- Contrastive Loss — 유사도 학습

---

## 3. 역전파와 최적화

### 역전파 (Backpropagation)
- 연쇄 법칙 (Chain Rule) 직관
- 계산 그래프 (Computational Graph)
- 순전파 (Forward Pass) vs 역전파 (Backward Pass)
- 수치 미분 vs 자동 미분 (Autograd)
- 기울기 소실 (Vanishing Gradient) 문제
- 기울기 폭발 (Exploding Gradient) 문제

### 경사 하강법 변형
- **SGD** — 확률적 경사 하강
- **Momentum** — 관성 추가
- **RMSProp** — 적응형 학습률
- **Adam** — Momentum + RMSProp
  - β1, β2, ε 파라미터
  - 편향 보정 (Bias Correction)
- **AdamW** — Weight Decay 분리 (현재 표준)
- **Lion** — 메모리 효율적 옵티마이저

### 학습률 스케줄러
- Step Decay, Exponential Decay
- Cosine Annealing — LLM 학습 표준
- Warmup + Cosine Decay 조합
- OneCycleLR — fast.ai 제안
- 학습률 찾기 (Learning Rate Finder)

---

## 4. 정규화와 학습 안정화

### 과적합 방지
- **Dropout** — 무작위 뉴런 비활성화
  - Inverted Dropout 구현
  - Dropout과 배치 정규화 순서
- **Weight Decay (L2)** — 가중치 크기 제약
- **Data Augmentation** — 학습 데이터 증강
- **Early Stopping** — 검증 손실 모니터링

### 정규화 레이어
- **Batch Normalization (BN)**
  - 내부 공변량 이동 (Internal Covariate Shift)
  - 학습/추론 모드 차이
  - BN의 한계 — 소배치에서 불안정
- **Layer Normalization (LN)** — Transformer 표준
- **Group Normalization** — 배치 크기 독립
- **RMS Norm** — LLaMA 등 LLM 표준 (LN보다 단순)

### 가중치 초기화
- 영 초기화 문제 (Symmetry Breaking)
- Xavier/Glorot 초기화 — 시그모이드/Tanh
- He 초기화 — ReLU 계열
- 초기화가 학습에 미치는 영향

### 기울기 클리핑 (Gradient Clipping)
- Norm Clipping vs Value Clipping
- RNN과 LLM 학습에서 필수

---

## 5. CNN — 이미지 처리

### CNN 기초
- 합성곱 연산 — 필터, 스트라이드, 패딩
- 특성 맵 (Feature Map)
- 풀링 — Max Pooling, Average Pooling
- 수용 필드 (Receptive Field)
- 파라미터 공유와 이동 불변성

### CNN 아키텍처 발전사
- **LeNet** (1998) — 최초의 실용적 CNN
- **AlexNet** (2012) — 딥러닝 혁명 시작
  - ReLU, Dropout, 데이터 증강
- **VGGNet** (2014) — 깊이의 중요성
- **GoogLeNet/Inception** — 병렬 합성곱 (1×1 Conv)
- **ResNet** (2015) — Residual Connection
  - 기울기 소실 해결, 1000층 학습 가능
- **DenseNet** — 모든 층 연결
- **EfficientNet** — 너비/깊이/해상도 균형 스케일링
- **ConvNeXt** — Vision Transformer에 대항한 현대 CNN

### 객체 탐지 (Object Detection)
- Two-Stage: R-CNN, Fast R-CNN, Faster R-CNN
- One-Stage: YOLO 계열 (v1 → v8 → v11)
- DETR — Transformer 기반 탐지
- RT-DETR — 실시간 Transformer 탐지

### 시맨틱 세그멘테이션
- FCN (Fully Convolutional Network)
- U-Net — 의료 이미지 표준
- DeepLab — Atrous Convolution
- Segment Anything Model (SAM)

---

## 6. RNN — 시퀀스 처리

### 순환 신경망 (RNN) 기초
- 시퀀스 데이터의 특성
- RNN 구조 — 은닉 상태 (Hidden State)
- 시간에 따른 역전파 (BPTT)
- 장기 의존성 문제 — 기울기 소실

### LSTM & GRU
- **LSTM** (Long Short-Term Memory)
  - 셀 상태 (Cell State) — 장기 기억
  - 입력/망각/출력 게이트
  - 기울기 소실 완화 메커니즘
- **GRU** (Gated Recurrent Unit)
  - LSTM 단순화 — 게이트 2개
  - LSTM과 성능 비슷, 파라미터 적음
- Bidirectional RNN/LSTM
- Stacked (Multi-layer) LSTM

### 시퀀스-투-시퀀스 (Seq2Seq)
- 인코더-디코더 구조
- Teacher Forcing
- Beam Search 디코딩
- Attention 메커니즘의 등장 배경

---

## 7. Attention과 Transformer

### Attention 메커니즘
- Bahdanau Attention (2014) — 신경망 번역의 전환점
- Query, Key, Value 개념
- 내적 Attention (Dot-Product Attention)
- **Scaled Dot-Product Attention**
  - 스케일링 이유 — 차원이 커질수록 내적값 커짐
- Soft vs Hard Attention

### Self-Attention
- 시퀀스 내 각 위치가 다른 위치를 참조
- 병렬 처리 가능 — RNN 대비 학습 속도 향상
- 장거리 의존성 포착 — RNN보다 뛰어남

### Multi-Head Attention
- 여러 관점에서 동시에 Attention
- 헤드별 역할 분담 (구문, 의미, 참조 등)
- Concatenate + Linear Projection

### Transformer 아키텍처 (2017, "Attention is All You Need")
- 인코더 스택 — Self-Attention + FFN
- 디코더 스택 — Masked Self-Attention + Cross-Attention + FFN
- 위치 인코딩 (Positional Encoding)
  - 사인/코사인 고정 인코딩
  - 학습 가능한 위치 임베딩
  - RoPE (Rotary Position Embedding) — LLM 표준
- 잔차 연결 (Residual Connection)
- 레이어 정규화

---

## 8. 생성 모델 (Generative Models)

### GAN (Generative Adversarial Network)
- 생성자(Generator) vs 판별자(Discriminator)
- 민맥스 게임과 Nash 균형
- 학습 불안정 문제 — Mode Collapse, Training Collapse
- **DCGAN** — 합성곱 기반 안정화
- **Conditional GAN (cGAN)** — 조건 제어
- **StyleGAN** — 스타일 기반 이미지 생성
- **Pix2Pix, CycleGAN** — 이미지 변환
- GAN의 한계와 Diffusion Model로의 전환

### VAE (Variational Autoencoder)
- 잠재 공간 (Latent Space) 개념
- ELBO (Evidence Lower Bound) 목적 함수
- 재파라미터화 트릭 (Reparameterization Trick)
- 잠재 공간 보간(Interpolation) — 연속적 변환

### Diffusion Model
- 확산 과정 — 점진적 노이즈 추가
- 역확산 — 노이즈에서 이미지 복원
- DDPM (Denoising Diffusion Probabilistic Model)
- DDIM — 더 빠른 샘플링
- **Latent Diffusion Model (LDM)** — Stable Diffusion의 기반
  - VAE로 잠재 공간 압축 → 잠재 공간에서 확산
- **Score Matching** — 이론적 기반
- Classifier-Free Guidance (CFG) — 조건부 생성 강화

---

## 9. Vision Transformer와 최신 비전 모델

### Vision Transformer (ViT)
- 이미지 → 패치 분할 → 토큰화
- Positional Embedding (2D)
- ViT가 CNN보다 나은 점, 약한 점
- 데이터 효율성 문제 — 대규모 데이터 필요

### 효율적 Transformer 변형
- **Swin Transformer** — 계층적 구조, 지역 Attention
- **DeiT** — 지식 증류로 데이터 효율성 향상
- **BEiT, MAE** — 마스크 이미지 모델링 (비전 BERT)

### Vision-Language 모델
- **CLIP** (Contrastive Language-Image Pre-training)
  - 이미지-텍스트 쌍으로 대조 학습
  - Zero-shot 분류, 이미지 검색
- **ALIGN** — CLIP 대규모 버전
- **LLaVA, InstructBLIP** — 비전 LLM 통합

---

## 10. 자연어 처리와 LLM

### 단어 표현 (Word Representation)
- 원핫 인코딩의 한계
- **Word2Vec** — CBOW, Skip-gram
- **GloVe** — 전역 통계 활용
- **FastText** — 서브워드 임베딩
- 컨텍스트 임베딩의 필요성

### 서브워드 토크나이저
- BPE (Byte Pair Encoding) — GPT 계열
- WordPiece — BERT 계열
- SentencePiece — 언어 독립적
- 어휘 크기와 OOV 문제 트레이드오프

### BERT와 Encoder 모델
- **BERT** (2018, Google)
  - 양방향 Transformer 인코더
  - MLM (Masked Language Modeling) 사전 학습
  - NSP (Next Sentence Prediction)
  - Fine-tuning 패러다임 정착
- **RoBERTa** — BERT 학습 최적화
- **ALBERT** — 파라미터 공유로 경량화
- **DeBERTa** — Disentangled Attention

### GPT와 Decoder 모델
- **GPT-1** (2018) — Language Model Fine-tuning
- **GPT-2** (2019) — "Too Dangerous to Release"
- **GPT-3** (2020) — 175B, Few-shot 학습
- Causal Language Modeling (CLM) — 자기회귀 생성
- In-Context Learning — 프롬프트만으로 학습 없이 적응

### 현대 LLM 아키텍처
- **LLaMA** — Meta의 오픈소스 LLM
  - RMSNorm, RoPE, SwiGLU
  - LLaMA 2, 3 발전
- **Mistral, Mixtral** — MoE (Mixture of Experts)
- **Gemma, Phi** — 소형 고효율 모델
- **GPT-4, Claude 3/4, Gemini** — 최신 상용 모델

---

## 11. 학습 기법 심화

### 전이 학습 (Transfer Learning)
- 사전 학습 (Pre-training) + 미세 조정 (Fine-tuning)
- Feature Extraction vs Full Fine-tuning
- 도메인 적응 (Domain Adaptation)
- 전이 학습이 효과적인 이유

### 미세 조정 (Fine-tuning) 기법
- **Full Fine-tuning** — 모든 파라미터 업데이트
- **PEFT (Parameter-Efficient Fine-Tuning)**
  - **LoRA** (Low-Rank Adaptation)
    - 가중치 행렬을 저랭크 분해
    - r, alpha 파라미터
    - QLoRA — 4비트 양자화 + LoRA
  - **Adapter** — 레이어 사이 소형 모듈 삽입
  - **Prefix Tuning** — 소프트 프롬프트
  - **Prompt Tuning** — 입력 임베딩 최적화

### RLHF와 정렬 (Alignment)
- SFT (Supervised Fine-Tuning) — 시연 데이터로 미세 조정
- Reward Model 학습 — 인간 선호도 점수화
- PPO (Proximal Policy Optimization) — 정책 최적화
- **DPO** (Direct Preference Optimization) — PPO 대안
- Constitutional AI — 원칙 기반 자기 수정
- RLAIF — AI 피드백으로 RLHF 대체

### 지식 증류 (Knowledge Distillation)
- Teacher-Student 프레임워크
- Soft Label의 정보량
- DistilBERT, TinyBERT — BERT 경량화
- Speculative Decoding — 소형 모델로 초안 → 대형 모델 검증

---

## 12. 효율성과 최적화

### 모델 경량화
- **양자화 (Quantization)**
  - FP32 → FP16 → INT8 → INT4
  - PTQ (Post-Training Quantization)
  - QAT (Quantization-Aware Training)
  - GPTQ, AWQ — LLM 양자화
- **프루닝 (Pruning)**
  - 구조적 vs 비구조적
  - 크기 불변 vs 크기 감소
- **지식 증류** — 10번 챕터 참조

### 효율적 Attention
- **Flash Attention** — IO 효율적 Attention (GPU 메모리 최적화)
- **Multi-Query Attention (MQA)** — Key/Value 헤드 공유
- **Grouped Query Attention (GQA)** — MQA와 MHA 절충
- **Sliding Window Attention** — 긴 시퀀스 처리

### 분산 학습 (Distributed Training)
- 데이터 병렬화 (Data Parallelism) — DDP
- 모델 병렬화 (Model Parallelism) — 텐서/파이프라인
- ZeRO (Zero Redundancy Optimizer) — DeepSpeed
- FSDP (Fully Sharded Data Parallel) — PyTorch 표준
- MoE (Mixture of Experts) — 조건부 활성화

---

## 13. 멀티모달과 최신 연구

### 멀티모달 모델
- 이미지 + 텍스트 — LLaVA, GPT-4V, Gemini
- 오디오 + 텍스트 — Whisper, AudioPaLM
- 비디오 이해 — VideoLLaMA, Gemini 1.5
- Any-to-Any — Unified-IO, GPT-4o

### 음성 처리
- Mel Spectrogram — 오디오 → 이미지
- **Whisper** (OpenAI) — 범용 음성 인식
- TTS (Text-to-Speech) — VALL-E, Bark
- 음성 합성의 Diffusion Model 적용

### 그래프 신경망 (GNN)
- 그래프 데이터 — 노드, 엣지, 특성
- Message Passing 프레임워크
- GCN, GraphSAGE, GAT (Graph Attention)
- 분자 설계, 소셜 네트워크, 지식 그래프

### 강화학습 + 딥러닝
- DQN — Atari 게임 정복
- Policy Gradient — REINFORCE, PPO, SAC
- AlphaGo, AlphaZero, MuZero
- RLHF에서의 PPO

---

## 14. 실무 딥러닝

### PyTorch 기초부터 심화
- Tensor 연산, Autograd
- nn.Module 구조화
- DataLoader, Dataset 커스터마이징
- 학습 루프 패턴
- 체크포인트 저장/로드
- Mixed Precision Training (torch.amp)

### 실험 관리와 재현성
- Weights & Biases, MLflow, TensorBoard
- 시드 고정 — 재현 가능한 실험
- 설정 파일 관리 — Hydra, OmegaConf
- 실험 비교 및 하이퍼파라미터 추적

### 배포와 서빙
- ONNX 변환과 런타임
- TorchScript, TorchServe
- Triton Inference Server — 고성능 서빙
- vLLM — LLM 고속 서빙 (PagedAttention)
- 모델 컴파일 — torch.compile

---

## 학습 로드맵

```
1단계 — 기초 (2개월)
  수학 기초 (선형대수, 미적분, 확률)
  Python + NumPy + PyTorch 기초
  MLP → 역전파 → MNIST 분류기 직접 구현

2단계 — 핵심 아키텍처 (3개월)
  CNN → 이미지 분류 실습 (CIFAR-10)
  RNN/LSTM → 시계열/텍스트 실습
  Transformer → 번역, 텍스트 분류

3단계 — 사전 학습 모델 활용 (2개월)
  Hugging Face Transformers 라이브러리
  BERT/GPT Fine-tuning
  LoRA/QLoRA 실습

4단계 — 생성 모델 (2개월)
  GAN 구현
  Stable Diffusion 파인튜닝 (LoRA)
  LLM Fine-tuning + RLHF 개념

5단계 — 실전 심화 (지속)
  논문 재현 구현
  캐글 딥러닝 대회 참여
  분산 학습 환경 구축
```

## 추천 자료

### 교재
- *Deep Learning* — Goodfellow, Bengio, Courville (무료 PDF, 이론 표준)
- *Dive into Deep Learning* — 아마존 팀 (무료 온라인, 코드 중심)
- *Understanding Deep Learning* — Simon Prince (2024, 최신)

### 강의
- fast.ai Practical Deep Learning (실용 중심, 강력 추천)
- Stanford CS231n (CNN), CS224n (NLP)
- Andrej Karpathy — Neural Networks: Zero to Hero (유튜브)

### 논문 (읽는 순서)
1. *Attention is All You Need* (2017) — Transformer
2. *BERT* (2018) — 언어 모델 사전 학습
3. *GPT-3* (2020) — In-Context Learning
4. *LoRA* (2021) — 효율적 미세 조정
5. *Denoising Diffusion Probabilistic Models* (2020) — Diffusion
6. *Flash Attention* (2022) — 효율적 Attention
