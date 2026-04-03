# AI Agent 완전 학습 인덱스

> **대전제**: AI Agent는 단순히 질문에 답하는 LLM이 아니라,
> **목표를 받아 스스로 계획을 세우고, 도구를 사용하고, 결과를 검증하며 목표를 달성하는 시스템**이다.
> 이 인덱스는 "LLM API를 처음 써보는 것"부터 "프로덕션 멀티에이전트 시스템 설계"까지의 경로를 정의한다.

---

## 왜 지금 AI Agent인가?

```
LLM 1세대: 프롬프트 → 응답 (단방향, 단발성)
LLM 2세대: 대화 → 컨텍스트 유지 (ChatGPT)
LLM 3세대: 목표 → 계획 → 도구 사용 → 검증 → 완료 (Agent)
```

Agent가 가능해진 이유:
- 모델의 추론 능력 비약적 향상 (GPT-4, Claude 3.5+)
- Function Calling / Tool Use API 표준화
- 비용 하락 — 긴 컨텍스트/반복 호출이 현실적

---

## 학습 맵 — 전체 구조

```
입문                  중급                    고급
──────────────────────────────────────────────────────
LLM 기초          │  에이전트 패턴       │  멀티에이전트
프롬프트 엔지니어링 │  메모리 시스템       │  자율 에이전트
Tool Use          │  RAG 고급           │  에이전트 평가
ReAct 패턴        │  오케스트레이션      │  프로덕션 운영
                  │  에이전트 프레임워크  │  안전/보안
```

---

## 1. 대전제 — AI Agent란 무엇인가

### Agent의 정의
- Autonomous Agent vs Copilot의 차이
- Agent의 4요소: Perception → Memory → Reasoning → Action
- 에이전트의 자율성 스펙트럼 (완전 자동화 ↔ 인간 개입)
- Human-in-the-Loop vs Fully Autonomous

### 왜 Agent 가 어려운가
- 환각(Hallucination) — 잘못된 계획 수립
- 컨텍스트 한계 — 긴 작업에서 정보 손실
- 도구 오남용 — 불필요한 API 호출
- 신뢰 전파 — 앞 단계 오류가 뒤 단계에 증폭
- 비용/지연 — 반복 LLM 호출의 누적

### Agent vs Workflow vs Automation
- 스크립트 자동화 (RPA) vs AI Agent
- 고정 워크플로우 vs 동적 에이전트
- 언제 Agent가 필요하고 언제 필요 없는가
- 과도한 에이전트화(Over-agentification) 경계

---

## 2. 입문 — LLM과 Tool Use 기초

### LLM API 기초
- OpenAI / Anthropic / Google API 구조 이해
- Chat Completions API — messages, role, content
- 토큰 개념 — 입력 토큰 vs 출력 토큰, 비용 계산
- 스트리밍 응답 처리
- 컨텍스트 윈도우 한계와 관리 전략

### 프롬프트 엔지니어링
- Zero-shot vs Few-shot Prompting
- Chain-of-Thought (CoT) — 단계별 추론 유도
- System Prompt 설계 원칙
- 출력 형식 제어 — JSON 강제, 구조화 응답
- 프롬프트 버전 관리

### Tool Use / Function Calling
- Function Calling 동작 원리
  - 도구 스키마 정의 (JSON Schema)
  - 모델의 도구 선택 과정
  - 도구 실행 결과 피드백
- 기본 도구 구현 — 웹 검색, 계산기, 파일 읽기
- Parallel Tool Use — 여러 도구 동시 호출
- Tool Use 오류 처리 — 실패 시 재시도 전략
- Anthropic Tool Use vs OpenAI Function Calling 비교

### 구조화 출력 (Structured Output)
- Pydantic + LLM 연동 — 타입 안전 응답
- JSON Mode vs Response Format
- Instructor 라이브러리 패턴
- 검증 실패 시 자동 재시도

---

## 3. 입문 — ReAct와 기본 에이전트 루프

### ReAct 패턴
- ReAct = Reasoning + Acting
- Thought → Action → Observation 루프
- ReAct 논문 핵심 내용
- CoT와의 차이 — 외부 상호작용 유무
- ReAct 실패 사례 — 무한 루프, 반복 실수

### 기본 에이전트 루프 구현
- 에이전트 루프의 5단계
  1. 사용자 목표 수신
  2. LLM으로 다음 행동 결정
  3. 도구 실행
  4. 결과를 컨텍스트에 추가
  5. 완료 조건 확인 → 반복
- 종료 조건 설계 — 목표 달성 vs 최대 반복
- 에러 복구 전략

### 첫 에이전트 만들기 (실습)
- Python으로 ReAct 에이전트 직접 구현
- 도구: 웹 검색 + 계산기 + 파일 저장
- 스트리밍으로 중간 과정 출력
- 비용 추적 미들웨어 추가

---

## 4. 중급 — 메모리 시스템

### 메모리의 종류
- **In-Context Memory** — 대화 히스토리 (단기)
- **External Memory** — 벡터 DB, Key-Value 저장소 (장기)
- **Episodic Memory** — 과거 작업 경험 저장
- **Semantic Memory** — 도메인 지식 저장
- **Procedural Memory** — 성공한 작업 패턴 저장

### 컨텍스트 관리 전략
- 슬라이딩 윈도우 — 최근 N개 메시지 유지
- 요약(Summarization) — 오래된 컨텍스트 압축
- 중요도 기반 필터링 — 핵심 정보만 유지
- 계층적 요약 — 세션 → 일 → 주 단위 압축

### 벡터 DB와 RAG 기초
- 임베딩(Embedding) 개념 — 의미를 벡터로
- 벡터 유사도 검색 — 코사인 유사도, FAISS
- 벡터 DB 선택 — Pinecone, Weaviate, Chroma, pgvector
- 기본 RAG 파이프라인
  1. 문서 청킹(Chunking)
  2. 임베딩 생성
  3. 벡터 저장
  4. 질의 임베딩 → 유사 문서 검색
  5. LLM 컨텍스트에 삽입

### 에이전트 장기 메모리 설계
- 언제 기억할지 결정 — 중요도 판단
- 메모리 업데이트 — 덮어쓰기 vs 추가 vs 요약
- 메모리 검색 최적화 — Hybrid Search (벡터 + BM25)
- 망각 메커니즘 — 오래된/비관련 메모리 제거

---

## 5. 중급 — 고급 RAG

### 기본 RAG의 한계
- Chunking 품질 문제 — 맥락 단절
- 검색 정확도 한계 — 단순 유사도 검색
- 다중 홉 질의 처리 어려움
- 최신 정보 반영 지연

### 청킹 전략
- Fixed-size Chunking — 단순하지만 맥락 단절
- Recursive Chunking — 구조 인식 분할
- Semantic Chunking — 의미 기반 분할
- Document-level Chunking — 메타데이터 보존
- Late Chunking — 임베딩 후 분할 (jina ai)

### 검색 품질 향상
- Hybrid Search — BM25 + Dense Retrieval
- Re-ranking — Cross-Encoder로 정밀 재정렬
- Query Expansion — 질의를 다양한 형태로 확장
- HyDE (Hypothetical Document Embedding)
- Multi-Query Retrieval — 여러 관점에서 검색

### 고급 RAG 아키텍처
- RAG Fusion — 여러 검색 결과 통합
- CRAG (Corrective RAG) — 검색 품질 자기 평가
- Self-RAG — 필요할 때만 검색
- GraphRAG (Microsoft) — 지식 그래프 기반
- Modular RAG — 파이프라인 컴포넌트화

---

## 6. 중급 — 에이전트 패턴

### 계획 패턴 (Planning Patterns)
- **Plan-and-Execute** — 전체 계획 후 실행
  - 장점: 전체 흐름 일관성
  - 단점: 계획 수정 어려움
- **ReAct** — 매 단계 결정
  - 장점: 유연한 적응
  - 단점: 지역 최적화 위험
- **Reflexion** — 실패 → 반성 → 재시도
  - 자기 비판(Self-critique) 메커니즘
- **Tree of Thoughts (ToT)** — 여러 가지 탐색

### 검증 패턴 (Verification Patterns)
- Self-Consistency — 여러 경로 실행 후 다수결
- Critic Agent — 별도 모델이 결과 검증
- Constitutional AI — 원칙 기반 자기 수정
- 단계별 검증 체크포인트 삽입

### 특화 에이전트 패턴
- **Coding Agent** — 코드 생성 → 실행 → 오류 수정 루프
- **Research Agent** — 검색 → 합성 → 보고서 작성
- **Browser Agent** — 웹 자동화 (Playwright 연동)
- **Data Analysis Agent** — 데이터 로드 → 분석 → 시각화
- **Customer Service Agent** — 의도 분류 → 액션 → 에스컬레이션

---

## 7. 중급 — 에이전트 프레임워크

### LangChain / LangGraph
- LangChain의 핵심 추상화 — Chain, Agent, Tool
- LangGraph — 상태 그래프 기반 에이전트
  - Node, Edge, State 개념
  - 조건부 분기, 루프 구현
  - 체크포인트 — 중간 상태 저장/복원
  - Human-in-the-Loop 구현

### LlamaIndex
- Document, Node, Index 추상화
- QueryEngine vs ChatEngine
- SubQuestion QueryEngine — 복합 질의 분해
- RouterQueryEngine — 여러 인덱스 라우팅
- Agent + RAG 통합 패턴

### Anthropic Claude Agent SDK
- Anthropic SDK의 Tool Use 패턴
- Computer Use API — 화면 제어 에이전트
- claude-agent-sdk 구조 이해
- 멀티턴 대화에서 도구 상태 관리

### CrewAI / AutoGen
- CrewAI — 역할 기반 멀티에이전트
  - Agent, Task, Crew 개념
  - 순차/병렬/계층 실행
- AutoGen (Microsoft) — 대화 기반 멀티에이전트
  - AssistantAgent, UserProxyAgent
  - GroupChat — 에이전트 토론
- 프레임워크 선택 기준

### 프레임워크 없이 직접 구현
- 프레임워크 추상화의 비용 (복잡성, 디버깅 어려움)
- 핵심 루프만 직접 구현하는 패턴
- 언제 프레임워크를 쓰고 언제 직접 짜는가

---

## 8. 고급 — 멀티에이전트 시스템

### 멀티에이전트 아키텍처
- **Supervisor 패턴** — 중앙 조율자 + 전문 에이전트
- **Peer-to-Peer** — 에이전트 간 직접 통신
- **Market-based** — 경쟁/입찰 기반 작업 분배
- **Blackboard 아키텍처** — 공유 메모리 기반 협업
- 언제 멀티에이전트가 단일 에이전트보다 나은가

### 에이전트 간 통신
- 메시지 포맷 표준화 — 구조화 메시지
- 작업 위임 (Task Delegation) 패턴
- 결과 집계 (Result Aggregation) 전략
- 교착 상태(Deadlock) 방지
- A2A (Agent-to-Agent) 프로토콜 (Google)

### MCP (Model Context Protocol)
- MCP란? — Anthropic이 제안한 에이전트 표준
- MCP 아키텍처 — Host, Client, Server
- MCP Server 구현 — 도구/리소스/프롬프트 노출
- MCP Client 연동 — Claude Desktop, Cursor
- MCP vs Function Calling 비교
- 커스텀 MCP 서버 개발 (Python/TypeScript SDK)

### 에이전트 상태 관리
- 분산 상태 동기화 — 에이전트 간 일관성
- 이벤트 소싱 — 에이전트 행동 로그
- 롤백/재시도 — 실패 복구 전략
- 장기 실행 작업 관리 — 체크포인트

---

## 9. 고급 — 자율 에이전트와 코딩 에이전트

### Coding Agent 심화
- SWE-bench — 실제 GitHub 이슈 해결 벤치마크
- 코드 실행 샌드박스 — Docker, E2B, Modal
- 코드 → 실행 → 오류 → 수정 루프
- 파일 시스템 탐색 및 컨텍스트 구성
- 대형 코드베이스 이해 전략

### Computer Use Agent
- GUI 자동화 — 화면 인식 + 클릭/타이핑
- Anthropic Computer Use API
- Browser 자동화 — Playwright, Puppeteer 연동
- 화면 캡처 → 행동 결정 루프
- 실제 사용 사례 — 데이터 추출, 레거시 시스템 연동

### Deep Research Agent
- 멀티홉 리서치 — 여러 검색 → 합성
- OpenAI Deep Research, Perplexity 아키텍처 분석
- 소스 신뢰도 평가
- 인용 추적 및 사실 검증
- 장기 리서치 작업 스케줄링

---

## 10. 고급 — 에이전트 평가

### 평가의 어려움
- 비결정론적 출력 — 같은 입력에 다른 결과
- 다단계 평가 — 최종 결과 vs 중간 과정
- 비용 vs 품질 트레이드오프
- 자동 평가 vs 인간 평가

### 벤치마크와 지표
- **SWE-bench** — 코딩 에이전트 (GitHub 이슈 해결률)
- **GAIA** — 범용 에이전트 (현실 작업)
- **WebArena** — 웹 자동화 에이전트
- **AgentBench** — 다양한 환경 종합 평가
- 커스텀 벤치마크 구축 방법

### LLM-as-Judge
- 모델이 모델 출력을 평가하는 패턴
- Prompt 설계 — 평가 기준 명시
- Pairwise 비교 vs Absolute 점수
- 편향(Bias) 문제 — 포지션 편향, 자기 선호
- 평가 파이프라인 자동화

### 테스트 전략
- 단위 테스트 — 개별 도구 테스트
- 통합 테스트 — 에이전트 루프 전체
- 회귀 테스트 — 모델 업데이트 후 성능 확인
- A/B 테스트 — 에이전트 버전 비교
- 섀도우 모드 — 실제 트래픽으로 조용히 평가

---

## 11. 고급 — 프로덕션 운영

### 신뢰성 설계
- 재시도 전략 — Exponential Backoff
- 타임아웃 설정 — 에이전트 루프 최대 시간
- Fallback 체인 — 기본 모델 → 더 강력한 모델
- Circuit Breaker — 연속 실패 시 차단
- 멱등성 보장 — 중복 실행 안전성

### 관찰 가능성 (Observability)
- 에이전트 추적 (Tracing) — LangSmith, Langfuse, Phoenix
  - Trace: 전체 실행 흐름
  - Span: 개별 LLM 호출, 도구 실행
  - Token 사용량, 지연 시간, 비용
- 구조화 로깅 — 에이전트 결정 이유 기록
- 실시간 모니터링 대시보드
- 알람 — 오류율, 비용 초과, 지연 급증

### 비용 최적화
- 모델 선택 전략 — 작업 복잡도별 모델 분기
  - 단순 분류 → 소형 모델
  - 복잡 추론 → 대형 모델
- 프롬프트 캐싱 — Anthropic Prompt Caching
- 배치 처리 — 비실시간 작업 묶음 처리
- 컨텍스트 압축 — 불필요한 토큰 제거

### 보안
- Prompt Injection 공격 — 외부 입력이 에이전트를 조작
- 도구 사용 권한 제어 — 최소 권한 원칙
- 샌드박스 격리 — 코드 실행, 파일 접근 제한
- 출력 검증 — 생성된 콘텐츠 필터링
- Jailbreak 방어 전략

---

## 12. 고급 — 최신 연구 동향

### Agentic AI 최전선
- Agent as Infrastructure — 에이전트를 서비스처럼 배포
- Self-improving Agent — 자기 개선 루프
- Mixture of Agents — 여러 모델 앙상블
- Tool Synthesis — 에이전트가 스스로 도구를 만듦

### 주목할 프레임워크/프로젝트
- **OpenAI Agents SDK** — Swarm 후속
- **Google ADK** (Agent Development Kit)
- **Smolagents** (HuggingFace) — 경량 에이전트
- **Pydantic AI** — 타입 안전 에이전트
- **Mastra** — TypeScript 에이전트 프레임워크

### 에이전트 경제학
- Agent-to-Agent 결제 — 에이전트가 API를 구매
- 에이전트 마켓플레이스
- 인간 노동 대체 vs 증강의 경계
- 에이전트 거버넌스 — 책임 소재

---

## 학습 로드맵

### 입문 (1~2개월)
```
Week 1~2: LLM API + 프롬프트 엔지니어링
  └── OpenAI/Anthropic API 실습, 프롬프트 패턴 익히기

Week 3~4: Tool Use 구현
  └── Function Calling으로 웹 검색, DB 조회 도구 만들기

Week 5~6: 첫 에이전트 (ReAct)
  └── Python으로 직접 ReAct 루프 구현

Week 7~8: 프레임워크 입문
  └── LangGraph 또는 CrewAI로 동일 에이전트 재구현
```

### 중급 (2~3개월)
```
RAG 파이프라인 구축 → 메모리 시스템 → 멀티에이전트 패턴
→ LangSmith로 추적 → 비용 최적화
```

### 고급 (지속)
```
MCP 서버 개발 → SWE-bench 도전 → 프로덕션 배포
→ 평가 파이프라인 → 논문 재현 (ReAct, Reflexion, ToT)
```

---

## 추천 자료

### 논문 (읽는 순서)
1. *ReAct: Synergizing Reasoning and Acting in LLMs* (2022)
2. *Toolformer* — 도구 사용 자기 학습 (2023)
3. *Tree of Thoughts* — 가지 탐색 (2023)
4. *Reflexion* — 자기 반성 에이전트 (2023)
5. *Self-RAG* — 선택적 검색 (2023)
6. *AgentBench* — 에이전트 벤치마크 (2023)

### 실습 자료
- Anthropic 공식 Prompt Engineering Guide
- LangGraph Academy (무료)
- DeepLearning.AI — "AI Agents in LangGraph"
- Hugging Face Agents Course
