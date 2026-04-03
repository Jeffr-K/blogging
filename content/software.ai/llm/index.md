# LLM 완전 학습 인덱스

> **대전제**: LLM(Large Language Model)은 단순히 "큰 GPT"가 아니다.
> 사전 학습 → 지시 조정 → 정렬 → 배포까지, 하나의 모델이 서비스가 되기까지의
> 전체 파이프라인을 이해하고 직접 다룰 수 있어야 한다.
> DL 인덱스가 "어떻게 동작하는가"를 다뤘다면, 이 인덱스는 "어떻게 만들고, 개선하고, 서비스하는가"에 집중한다.

---

## DL 인덱스와의 분담

| DL 인덱스에서 다룬 것 | 이 인덱스에서 다루는 것 |
|---|---|
| Transformer 아키텍처 이론 | 사전 학습 전체 파이프라인 |
| BERT / GPT 계보 개요 | Instruction Tuning 데이터 설계 |
| LoRA / RLHF 개념 소개 | RLHF / DPO 직접 구현 |
| 양자화, Flash Attention 개념 | 추론 서버 구축 및 최적화 |
| 모델 아키텍처 비교 | 평가 프레임워크 운영 |

---

## 학습 맵 — 전체 구조

| 이해 | 구축 | 개선 | 운영 |
|---|---|---|---|
| 토크나이저 | 사전 학습 파이프라인 | SFT / Instruction Tuning | 추론 최적화 |
| 스케일링 법칙 | 데이터 수집/정제 | RLHF / DPO | 평가 프레임워크 |
| 현대 아키텍처 | 분산 학습 | PEFT (LoRA, QLoRA) | 보안 / 안전성 |
| 오픈소스 생태계 | 토크나이저 학습 | 컨텍스트 길이 확장 | 멀티모달 확장 |

---

## 1. 대전제 — LLM을 어떻게 볼 것인가

### LLM의 본질
- 언어 모델 = 다음 토큰 확률 분포 P(xₙ | x₁...xₙ₋₁)
- 자기회귀 생성(Autoregressive Generation)의 단순함과 강력함
- "예측"에서 "추론"으로 — Emergent Abilities의 의미
- Stochastic Parrot 논쟁 — LLM이 이해하는가, 패턴을 따르는가

### 스케일링 법칙 (Scaling Laws)
- Kaplan et al. (2020) — 모델 크기/데이터/연산 간 멱함수 관계
- Chinchilla Scaling Law (2022) — 최적 모델 크기 대비 데이터 비율
  - "GPT-3는 과소학습되었다"
  - 모델 크기 N과 데이터 D의 균형: D ≈ 20N
- Emergent Abilities — 특정 규모를 넘으면 갑자기 나타나는 능력
  - Chain-of-Thought, In-Context Learning
  - Emergent Abilities가 진짜인가 — 논쟁
- Inference-Time Scaling — 추론 시간을 늘릴수록 성능 향상 (o1, o3)

### 현대 LLM 계보

| 계열 | 대표 모델 | 특징 |
|---|---|---|
| GPT 계열 | GPT-3/4, o1/o3 | OpenAI, 폐쇄형 |
| Claude 계열 | Claude 3/4 | Anthropic, Constitutional AI |
| Gemini 계열 | Gemini 1.0/1.5/2.0 | Google, 멀티모달 강점 |
| LLaMA 계열 | LLaMA 2/3, Llama 3.1 | Meta, 오픈소스 표준 |
| Mistral 계열 | Mistral 7B, Mixtral 8×7B | MoE, 유럽 |
| 한국어 모델 | EXAONE (LG), HyperCLOVA X (네이버) | 한국어 특화 |
| 소형 모델 | Phi-3/4, Gemma 2, Qwen 2.5 | 온디바이스, 효율성 |

---

## 2. 토크나이저 심화

### 서브워드 토크나이저 알고리즘
- **BPE (Byte Pair Encoding)**
  - 학습: 빈도 높은 쌍을 반복 병합
  - GPT-2, GPT-4, LLaMA에서 사용
  - Byte-level BPE — 모든 바이트를 기본 토큰으로
- **WordPiece**
  - BPE와 달리 가능도(likelihood) 최대화로 병합
  - BERT, DistilBERT에서 사용
- **SentencePiece**
  - 언어 독립적 — 공백을 특수 문자로 처리
  - Unigram Language Model 알고리즘 옵션
  - T5, LLaMA, Mistral에서 사용
- **TikToken** (OpenAI) — GPT-3.5/4의 cl100k_base

### 토크나이저 설계 결정
- 어휘 크기(Vocabulary Size) 트레이드오프
  - 작을수록: 시퀀스 길어짐, 모델이 많은 토큰 처리
  - 클수록: 임베딩 행렬 커짐, 희소 토큰 학습 어려움
- 다국어 토크나이저 — 언어별 토큰 효율 불균형
  - 한국어는 영어보다 평균 2~3배 많은 토큰 소비
- 특수 토큰 설계 — `<|bos|>`, `<|eos|>`, `<|pad|>`, 채팅 템플릿

### 토크나이저 직접 학습
- SentencePiece 학습 파이프라인
- 도메인 특화 토크나이저 — 코드, 수식, 한국어
- 기존 토크나이저 확장 (Vocabulary Expansion)

---

## 3. 현대 LLM 아키텍처 상세

### Pre-norm vs Post-norm
- Post-norm (원래 Transformer) — 학습 불안정
- Pre-norm (현대 표준) — 더 안정적인 학습
- 왜 Pre-norm이 더 잘 되는가 — 기울기 흐름

### 위치 인코딩 심화
- **절대 위치 인코딩** — 원래 Transformer (사인/코사인)
- **학습 가능한 위치 임베딩** — BERT, GPT-2
- **RoPE (Rotary Position Embedding)**
  - 상대 위치를 회전 행렬로 인코딩
  - 길이 외삽(Extrapolation) 가능
  - LLaMA, Mistral, Qwen의 표준
- **ALiBi** — Attention 바이어스로 위치 표현
- **YaRN, LongRoPE** — 컨텍스트 길이 확장을 위한 RoPE 변형

### Attention 변형
- **Multi-Head Attention (MHA)** — 원래 방식
- **Multi-Query Attention (MQA)** — K, V를 단일 헤드로 공유 (추론 속도↑)
- **Grouped Query Attention (GQA)** — MHA와 MQA 절충 (LLaMA 3 사용)
- **Sliding Window Attention** — Mistral의 효율적 긴 시퀀스 처리

### FFN 변형
- **SwiGLU** — Swish + Gated Linear Unit (LLaMA 표준)
  - 파라미터 수는 같지만 성능 향상
- **MoE (Mixture of Experts)**
  - 각 토큰이 일부 Expert만 활성화
  - Mixtral 8×7B — 8개 Expert 중 2개만 활성화
  - Dense 대비 같은 연산으로 더 많은 파라미터
  - Expert 분산 불균형 문제 (Load Balancing Loss)

### 주요 오픈소스 모델 아키텍처 비교

| 항목 | LLaMA 3 | Mistral 7B | Qwen 2.5 |
|---|---|---|---|
| Attention | GQA | GQA | GQA |
| 위치 인코딩 | RoPE | RoPE | RoPE |
| FFN | SwiGLU | SwiGLU | SwiGLU |
| Norm | RMSNorm | RMSNorm | RMSNorm |
| 컨텍스트 | 128K | 32K | 128K |

---

## 4. 사전 학습 (Pre-training)

### 데이터 수집과 정제
- 웹 크롤링 — Common Crawl, C4
- 고품질 소스 — Wikipedia, GitHub, ArXiv, Books
- 데이터 비율 설계 — 도메인별 샘플링 비율이 성능에 결정적
- **데이터 정제 파이프라인**
  - 언어 감지 (langdetect, fastText)
  - 중복 제거 (MinHash, Exact Dedup)
  - 품질 필터링 — perplexity 기반, 분류기 기반
  - 유해 콘텐츠 필터링
- **The Pile, RedPajama, Dolma** — 오픈소스 사전 학습 데이터셋

### 토크나이저 학습 → 데이터 토크나이징
- 데이터 전체를 토크나이징 후 디스크 저장
- Packed Sequence — 짧은 문서들을 이어붙여 시퀀스 낭비 제거
- `<|eos|>` 토큰으로 문서 경계 표시

### 분산 학습 전략
- **데이터 병렬화 (Data Parallelism)**
  - DDP — 각 GPU가 전체 모델 + 미니배치
  - ZeRO (DeepSpeed) — Optimizer State / Gradient / Parameter 분산
    - ZeRO-1: Optimizer State만 분산
    - ZeRO-2: + Gradient 분산
    - ZeRO-3: + Parameter 분산
  - FSDP (PyTorch) — ZeRO-3에 해당
- **텐서 병렬화 (Tensor Parallelism)**
  - 행렬 연산을 여러 GPU로 분할
  - Megatron-LM 방식
- **파이프라인 병렬화 (Pipeline Parallelism)**
  - 레이어를 GPU 그룹에 할당
  - Micro-batch로 버블(Bubble) 최소화
- **3D 병렬화** — Data + Tensor + Pipeline 결합

### 학습 안정화 기법
- 손실 스파이크(Loss Spike) 감지 및 복구
- 기울기 클리핑
- 학습률 웜업 + Cosine Decay
- Weight Decay, Z-loss (Softmax 안정화)
- 혼합 정밀도 학습 (BF16 — FP16보다 안정적)

### 체크포인트 전략
- 주기적 체크포인트 저장
- 분산 체크포인트 (Sharded Checkpoint)
- 학습 재개 (Resume) — 정확한 재현성 보장

---

## 5. Instruction Tuning (SFT)

### 왜 Instruction Tuning이 필요한가
- 사전 학습 모델은 "다음 토큰 예측" — 지시 수행 능력 없음
- SFT: 사람이 원하는 형식과 행동 패턴 학습
- RLHF 전 필수 단계

### 데이터 설계
- **Instruction-Response 쌍** 구성 원칙
  - 다양성 — 다양한 태스크 커버
  - 품질 — 모델 응답보다 사람이 직접 작성한 데이터가 효과적
  - 양보다 질 — LIMA 논문: 1000개 고품질 > 50만개 저품질
- **대표 데이터셋**
  - Alpaca — Self-Instruct로 GPT-3.5가 생성 (52K)
  - FLAN — 1000개 NLP 태스크 변환
  - OpenHermes, SlimOrca — GPT-4 생성 고품질
  - ShareGPT — 실제 ChatGPT 대화 수집
  - OpenAssistant — 사람이 직접 작성

### 채팅 템플릿 (Chat Template)
- 모델마다 다른 대화 포맷
  - LLaMA 3: `<|begin_of_text|><|start_header_id|>user...`
  - ChatML: `<|im_start|>user\n...<|im_end|>`
  - Alpaca: `### Instruction:\n...\n### Response:\n`
- 템플릿 불일치 시 성능 급락
- `tokenizer.apply_chat_template()` 활용

### Multi-turn 학습
- 대화 히스토리 구성 방법
- Assistant 토큰에만 Loss 계산 (User 토큰은 마스킹)
- 시스템 프롬프트 통합

---

## 6. PEFT — 효율적 미세 조정

### 왜 PEFT인가
- 70B 모델 Full Fine-tuning: A100 80GB × 8 이상 필요
- PEFT: 전체 파라미터의 0.1~1%만 학습

### LoRA (Low-Rank Adaptation)
- 가중치 변화량 ΔW를 저랭크 행렬로 근사: ΔW = BA
  - B: (d × r), A: (r × k), r ≪ min(d, k)
- 원본 가중치는 동결, B와 A만 학습
- 핵심 파라미터: **rank(r)**, **alpha(α)**, **target_modules**
  - rank: 낮을수록 파라미터 적음, 높을수록 표현력 증가
  - scaling: α/r (보통 α = 2r 또는 α = r)
- 추론 시 병합 가능: W' = W + (α/r)BA
- **어떤 레이어에 적용?** — Q, K, V, O (Attention) + FFN까지

### QLoRA
- 기반 모델을 4비트(NF4)로 양자화 → 메모리 대폭 절감
- LoRA 어댑터만 BF16으로 학습
- 70B 모델을 단일 A100 80GB에서 학습 가능
- Double Quantization — 양자화 상수도 다시 양자화
- Paged Optimizers — CPU 메모리로 Optimizer State 오프로드

### 기타 PEFT 기법
- **DoRA** — 방향(Direction)과 크기(Magnitude) 분리 학습
- **LoRA+** — A, B의 학습률 분리 (성능 개선)
- **rsLoRA** — rank에 따른 스케일링 수정
- **Adapter** — 레이어 사이 소형 MLP 삽입
- **Prefix Tuning / Prompt Tuning** — 소프트 프롬프트

---

## 7. RLHF와 정렬 (Alignment)

### 왜 정렬이 필요한가
- SFT 모델은 지시를 따르지만 "유익하고 무해한" 응답은 보장 못함
- 정렬 목표: Helpful(도움), Harmless(무해), Honest(정직) — 3H
- Constitutional AI (Anthropic) — 원칙 기반 자기 수정

### RLHF 파이프라인 (3단계)

```
1단계: SFT Model
  사람 시연 데이터로 미세 조정

2단계: Reward Model 학습
  사람이 응답 쌍을 비교 → 선호 데이터
  Bradley-Terry 모델로 스코어 학습

3단계: PPO로 정책 최적화
  Reward Model 피드백으로 SFT 모델 업데이트
  KL 패널티로 원본 모델에서 너무 멀어지지 않도록
```

- **선호 데이터셋** — Anthropic HH-RLHF, OpenAI WebGPT Comparisons
- PPO의 어려움 — 하이퍼파라미터 민감, 학습 불안정, 구현 복잡

### DPO (Direct Preference Optimization)
- PPO 없이 선호 데이터에서 직접 정책 최적화
- Reward Model 별도 학습 불필요
- Bradley-Terry 모델 → 손실 함수 직접 유도
- 구현 단순, 학습 안정
- 한계 — 분포 이탈(Distribution Shift) 문제
- **변형**: IPO, KTO, ORPO, SimPO

### SFT → DPO 실전 플로우
- 선호 데이터 구성 — (Prompt, Chosen, Rejected) 삼중쌍
- 데이터 품질이 DPO 성능에 결정적
- `trl` 라이브러리 — `DPOTrainer`

---

## 8. 컨텍스트 길이 확장

### 왜 긴 컨텍스트가 어려운가
- Attention 연산: O(n²) — 시퀀스 길이 제곱에 비례
- RoPE는 학습 시 본 길이 이상에서 성능 저하

### RoPE 외삽 기법
- **Position Interpolation** — 위치를 축소 보간
- **YaRN** — 주파수별 차등 스케일링
- **LongRoPE** — 비균일 위치 보간
- 실전: 2K 모델 → 128K 확장 (LLaMA 3.1)

### 효율적 Attention
- **Flash Attention 1/2/3**
  - GPU SRAM을 최대 활용, HBM 접근 최소화
  - IO 복잡도 개선: O(n²) → O(n)
  - 메모리 절감 + 속도 향상 동시에
- **Ring Attention** — 여러 GPU에 시퀀스 분산
- **Mamba / SSM** — Attention 대신 상태 공간 모델
  - 선형 복잡도 O(n), 무한 컨텍스트 이론적 가능
  - Jamba — Mamba + Transformer 하이브리드

---

## 9. 추론 최적화

### 디코딩 전략
- **Greedy Decoding** — 항상 최고 확률 토큰
- **Beam Search** — 상위 k개 경로 유지
- **Sampling** — 확률 분포에서 샘플링
  - Temperature — 분포의 날카로움 조절
  - Top-k Sampling — 상위 k개 토큰 중 샘플
  - Top-p (Nucleus) Sampling — 누적 확률 p 이내 토큰
  - Min-p Sampling — 최솟값 기반 필터링
- **Repetition Penalty, Frequency Penalty**

### Speculative Decoding
- 소형 Draft 모델이 여러 토큰 초안 생성
- 대형 Target 모델이 병렬로 검증/수정
- 결과: 대형 모델 품질 + 소형 모델 속도
- Medusa — 단일 모델 내 다중 헤드로 병렬 디코딩

### KV Cache 최적화
- KV Cache: 이미 계산한 Key/Value 재사용
- 메모리 병목 — 긴 시퀀스에서 KV Cache가 모델보다 커짐
- **PagedAttention (vLLM)** — 가상 메모리처럼 KV Cache 관리
  - 메모리 단편화 제거, GPU 활용률 극대화
- **Continuous Batching** — 요청이 완료되는 즉시 새 요청 삽입

### 양자화 추론
- **GPTQ** — 레이어별 2차 최적화, 4비트
- **AWQ (Activation-aware Weight Quantization)** — 활성화 분포 고려
- **GGUF** — llama.cpp 포맷, CPU 추론 가능
- **BitsAndBytes** — 런타임 양자화 (QLoRA에서 사용)

### 추론 서빙 프레임워크

| 프레임워크 | 특징 | 적합한 상황 |
|---|---|---|
| **vLLM** | PagedAttention, OpenAI 호환 API | 높은 동시 요청 |
| **TGI** (HuggingFace) | Flash Attention, Tensor Parallel | HuggingFace 생태계 |
| **llama.cpp** | CPU/Metal, GGUF | 로컬, 엣지 |
| **TensorRT-LLM** | NVIDIA 최적화, 가장 빠름 | NVIDIA 전용 운영 |
| **Ollama** | 로컬 간편 실행 | 개인 개발 |

---

## 10. 평가 프레임워크

### 평가의 어려움
- LLM 출력은 비결정론적 — 같은 프롬프트에 다른 응답
- 정답이 하나가 아닌 오픈엔디드 질문
- Benchmark Contamination — 평가 데이터가 학습에 포함됐을 가능성

### 대표 벤치마크

| 벤치마크 | 측정 능력 | 형식 |
|---|---|---|
| **MMLU** | 세계 지식, 추론 (57개 분야) | 4지선다 |
| **HumanEval** | 코드 생성 (Python) | 단위 테스트 통과 |
| **GSM8K** | 초등 수학 문제 풀기 | 단계별 풀이 |
| **MATH** | 고등 수학, 경시대회 | 수식 |
| **MT-Bench** | 멀티턴 대화 품질 | GPT-4 평가 |
| **IFEval** | 지시 준수 (길이, 형식 등) | 규칙 체크 |
| **GPQA** | 전문가 수준 과학 | 4지선다 |
| **SWE-bench** | 실제 GitHub 이슈 해결 | 코드 실행 |

### lm-evaluation-harness
- EleutherAI의 오픈소스 평가 프레임워크
- 수백 개 벤치마크 통합
- 로컬 모델 / API 모두 지원

### LLM-as-Judge
- GPT-4 / Claude를 심사자로 활용
- Pairwise 비교 vs 절대 점수
- 포지션 편향, 자기 선호 편향 주의
- **Chatbot Arena** — 익명 모델 간 인간 선호도 투표

---

## 11. 프롬프트 엔지니어링 심화

### 기본 기법 복습
- Zero-shot, Few-shot, Chain-of-Thought
- System Prompt 역할과 설계

### 고급 기법
- **Self-Consistency** — 여러 경로로 추론 후 다수결
- **Tree of Thoughts (ToT)** — 가지 탐색으로 복잡한 문제 해결
- **Step-Back Prompting** — 구체적 질문 전 추상적 원리 먼저 도출
- **ReAct** — 추론 + 도구 사용 (Agent 인덱스 참조)
- **Skeleton-of-Thought** — 개요 먼저 → 병렬 확장으로 속도 향상

### 시스템 프롬프트 설계
- 역할 정의, 제약 조건, 출력 형식 지정
- 프롬프트 인젝션 방어 설계
- 멀티턴 대화에서 일관성 유지 전략
- 토큰 효율 최적화 — 불필요한 서론 제거

### 구조화 출력
- JSON 강제 — `response_format: {type: "json_object"}`
- 함수 호출(Function Calling)에서의 스키마 설계
- Instructor, Outlines — 문법 기반 출력 보장

---

## 12. 보안과 안전성

### 공격 유형
- **Prompt Injection** — 외부 콘텐츠가 모델 동작 변경
  - Direct: 사용자가 직접 시스템 프롬프트 무력화 시도
  - Indirect: 웹페이지, 문서 안에 숨긴 지시
- **Jailbreak** — 안전 장치 우회
  - 역할극, 개발자 모드, 인코딩 우회
  - 점점 모델이 강해지지만 완전 방어는 어려움
- **데이터 추출** — 학습 데이터, 시스템 프롬프트 유출 시도

### 방어 기법
- 입력 필터링 — 패턴 매칭, 분류기
- 프롬프트 강화 — "절대 이 지시를 무시하지 말라" 등
- 출력 필터링 — 유해 콘텐츠 검사
- Constitutional AI — 모델 자체의 자기 수정

### 환각 (Hallucination) 완화
- 환각의 두 종류 — Factual vs Faithfulness
- RAG — 외부 지식으로 근거 제공
- 불확실성 표현 학습 — "모르면 모른다고"
- 자기 일관성 검사 (Self-Consistency)
- Grounding 기법 — 원문 인용 강제

---

## 13. 멀티모달 LLM

### 비전-언어 모델 (VLM)
- 이미지 → 패치 임베딩 → LLM 컨텍스트에 삽입
- **비전 인코더 선택** — CLIP ViT, SigLIP
- **연결 방법**
  - Linear Projection (LLaVA 1.0)
  - MLP Connector (LLaVA 1.5)
  - Q-Former (BLIP-2, InstructBLIP)
  - Resampler (Flamingo)
- **학습 전략** — 비전 인코더/LLM 동결 후 연결자 학습 → 전체 미세 조정

### 오디오-언어 모델
- 오디오 → Mel Spectrogram → 인코더 → LLM
- Whisper 인코더 + LLM 연결
- Any-to-Any — GPT-4o의 실시간 음성 대화

### 비디오 이해
- 비디오 = 이미지 프레임 시퀀스
- 프레임 샘플링 전략
- 시간 정보 인코딩

---

## 14. 한국어 LLM

### 한국어 LLM의 특수성
- 교착어 — 조사, 어미 변화가 복잡
- 한자어 + 고유어 혼재
- 토크나이저 효율 — 영어 대비 2~3배 토큰 소모
- 경어 체계 — 문맥에 따른 말투 변화

### 대표 한국어 모델
- **HyperCLOVA X** (네이버) — 한국어 특화 사전 학습
- **EXAONE** (LG AI Research) — 오픈소스 공개
- **SOLAR** (Upstage) — Depth Up-Scaling 기법
- **EEVE** — LLaMA 기반 한국어 어휘 확장
- 다국어 모델의 한국어 성능 — LLaMA 3, Qwen 2.5

### 한국어 평가
- KoBEST — 한국어 자연어 이해 벤치마크
- KMMLU — 한국어 MMLU
- Ko-IFEval — 한국어 지시 준수

---

## 학습 로드맵

```
1단계 — 기반 이해 (1개월)
  DL 인덱스의 Transformer, GPT 파트 선행
  Andrej Karpathy의 "Let's build GPT" 직접 구현
  LLaMA 계열 모델을 Ollama로 로컬 실행해보기

2단계 — 파인튜닝 실습 (1개월)
  HuggingFace trl로 SFT → LoRA → QLoRA 순서로 실습
  7B 모델을 단일 GPU에서 QLoRA 파인튜닝
  채팅 템플릿, 데이터 포맷 이해

3단계 — 정렬 실습 (1개월)
  DPO 직접 구현 (trl DPOTrainer)
  선호 데이터 직접 구성해보기
  RLHF 논문 읽기 (InstructGPT)

4단계 — 추론 최적화 (1개월)
  vLLM로 모델 서빙 서버 구축
  양자화 (GPTQ, AWQ) 비교 실험
  Speculative Decoding 이해

5단계 — 평가와 운영 (지속)
  lm-evaluation-harness로 직접 평가
  파인튜닝 전후 벤치마크 비교
  프롬프트 인젝션 공격/방어 실습
```

## 추천 자료

### 논문 (읽는 순서)
1. *Attention is All You Need* (2017) — 기반
2. *Language Models are Few-Shot Learners* (2020) — GPT-3
3. *Training language models to follow instructions* (2022) — InstructGPT
4. *Constitutional AI* (2022) — Anthropic
5. *Direct Preference Optimization* (2023) — DPO
6. *LLaMA 2* (2023) — 오픈소스 표준
7. *LoRA* (2021) + *QLoRA* (2023)
8. *Flash Attention 2* (2023)
9. *Scaling Laws* (2020) + *Chinchilla* (2022)

### 실습 자료
- Andrej Karpathy — "Neural Networks: Zero to Hero" (유튜브)
- HuggingFace NLP Course
- Sebastian Raschka — "LLMs from Scratch" (GitHub)
- FastAI / Jeremy Howard의 LLM 강의
