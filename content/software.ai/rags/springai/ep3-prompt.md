---
title: "episode 3: prompt engineering"
author: oscar.rs
date: 2025-09-12
tags: ["ai", "spring", "spring-ai", "prompt engineering"]
---

# Prompt Engineering

프롬프트란 AI 모델 즉, 대규모 언어 모델(LLM) 사용자가 원하는 작업을 구체적으로 지시하거나 질문의 형태로 요구사항을 전달하는 일종의 명령문을 의미한다. LLM 은 입력된 프롬프트를 바탕으로 학습된 패턴과 지식을 활용해 그에 상응하는 출력을 생성하게 된다.

프롬프트는 모델에게 어떤 상황에서 무엇을 어떤 형식으로 응답해야할지 알려주는 중요한 역할을 한다.

# Spring AI 의 Prompt

Spring AI 에서 prompt 는 `Prompt` 클래스로 표현한다. `Prompt` 클래스에는 메세지와 대화옵션을 지정할 수 있다. 아래는 각 메세지 별 특징이다:

- SystemMessage: LLM 의 행동과 응답 스타일을 지시. 주로 LLM 이 입력을 해석하는 방법과 답변하는 방식을 지시.
- UserMessage: 사용자의 질문, 명령을 담고 있는 메세지. LLM 의 응답을 형성하는 기초가 되므로 매우 중요한 메세지.
- AssistantMessage: LLM 의 응답을 담고 있는 메세지. 단순한 답변 전달을 넘어, 대화 기억 유지에도 사용되어 일관되고 맥락에 맞는 대화에 도움을 준다.

### Prompt Template

프롬프트는 정적 텍스트 일 수도 있지만 동적 텍스트 일 수도 있다. 이런 동적 텍스트를 Prompt Templates 라고 한다. 프롬프트 템플릿은 데이터로 바인딩되어 완성된 프롬프트로 생성된다.

Spring AI 는 프롬프트 템플릿을 위해 PromptTemplate 를 제공한다. PromptTemplate 은 LLM 에 전달할 프롬프트를 자리 표시자가 있는 텍스트 템플릿 형태로 정의하고 데이터 바인딩을 통해 동적으로 프롬프트를 완성하는 역할을 한다.

다음은 topic 과 num 자리 표시자를 가지고 있는 PromptTemplate 을 생성한다.

```java
PromptTemplate promptTemplate = PromptTemplate.builder()
  .template("{topic}에 대해 농담 {num}개를 목록으로 출력해줘.")
  .build();
```

템플릿을 구성했다면 프롬프트를 생성하기 위해 create() 메서드를 사용한다. create() 메서드는 아래와 같이 작성한다:

```java
Prompt prompt = promptTemplate.create(Map.of("topic", "AI", "num", 3));
```

이렇게 생성하면 Prompt 인스턴스 내부에는 UserMessage 가 포함된다. 만약 SystemMessage 또는 AssistantMessage 를 포함시키고 싶다면 SystemPromptTemplate 과 AssistantPromptTemplate 을 생성하고 create() 메서드를 이용하면 된다.

```java
SystemPromptTemplate systemPromptTemplate = SystemPromptTemplate.builder()
  .template("당신은 AI 봇입니다.")
  .build();

AssistantPromptTemplate assistantPromptTemplate = AssistantPromptTemplate.builder()
  .template("당신은 AI 봇입니다.")
  .build();

Prompt prompt = promptTemplate.create(Map.of("topic", "AI", "num", 3));
```

> **Info**
> Prompt 인스턴스에 UserMessage 가 없이 SystemMessage 나 AssistantMessage 만 있는 경우는 없기 떄문에 create() 메서드는 UserMessage 를 생성하는 PromptTemplate 만 사용하는 것이 좋다.
>
> SystemMessage만 단독으로 사용하는 경우도 기술적으로 가능하며, 더 중요한 것은 이 설명이 여러 메시지를 조합하는 핵심적인 사용법을 간과하게 만든다는 점입니다. create() 메서드는 단지 UserMessage 하나만으로 Prompt를 만들 때 사용하는 편의 기능으로 이해하는 것이 좋습니다.

또한 PromptTemplate, SystemPromptTemplate, AssistantPromptTemplate 은 Prompt 만 반환하는 것이 아니라 "필요에 따라" 완성된 텍스트와 메세지 객체를 반환할 수도 있다.

이럴 경우 render() 와 createMessage() 메서드를 사용하면 된다. 프롬프트에 여러 가지 메세지를 포함시킬 때 사용하면 좋다.

```java
String userText = promptTemplate.render(Map.of("topic", "AI", "num", 3));
UserMessage userMessage = UserMessage.builder().content(userText).build();
```

render() 메서드는 다음과 같은 경우에 유용합니다.

복잡한 조합: 여러 템플릿의 결과(문자열)를 프로그래밍 로직으로 조합하여 최종적인 하나의 메시지 내용을 만들어야 할 때.

로깅 또는 디버깅: LLM에 보내기 전, 완성된 프롬프트 문자열을 직접 확인하고 싶을 때.

명시적인 객체 생성: 위에서 제시한 개선된 예제 코드처럼, 여러 종류의 Message 객체를 명시적으로 만들어 Prompt를 구성할 때 각 메시지의 내용을 채우기 위해 사용됩니다.



```java
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;

import java.util.List;
import java.util.Map;

// 1. 각 역할에 맞는 템플릿 생성
PromptTemplate userPromptTemplate = new PromptTemplate("{topic}에 대해 농담 {num}개를 목록으로 출력해줘.");
PromptTemplate systemPromptTemplate = new PromptTemplate("당신은 {character} AI 봇입니다. 모든 답변은 한국어로 해주세요.");

// 2. 각 템플릿을 기반으로 Message 객체 생성
Map<String, Object> params = Map.of(
    "topic", "AI",
    "num", 3,
    "character", "유머러스한"
);

UserMessage userMessage = new UserMessage(userPromptTemplate.render(params));
SystemMessage systemMessage = new SystemMessage(systemPromptTemplate.render(params));

// 3. 여러 Message를 리스트에 담아 Prompt 객체 생성
Prompt finalPrompt = new Prompt(List.of(systemMessage, userMessage));
```

### 코드 설명

### 여러개의 메세지 추가하기

LLM 에 요청할 떄 하나의 SystemMessage 와 하나의 UserMessage 만 프롬프트에 포함되는 것은 아니다. 대부분의 경우는 그렇겠지만 경우에 따라 한 개의 SystemMessage 와 여러 개의 UserMessage, 여러개의 AssistantMessage 도 같이 포함될 수 있다.

대표적인 예로 대화 기억을 유지하기 위해 이전 대화 내용 (UserMessage + AssistantMEssage) 전체를 프롬프트에 포함시킬 수 있다.

```java

```

### Mutiple Message

### Default Message

# Prompt Enginnering

프롬프트 엔지니어링(Prompt Engineering)은 대규모 언어 모델(LLM)을 효괒거으로 활용하기 위해 입력 프롬프트를 설계하고 최적화하는 과정을 의미한다.

이는 LLM 이 주어진 입력을 정확하게 이해하고 목표에 부합하는 출력을 생성할 수 있도록 돕는 중요한 작업이다.

> 프롬프트 엔지니어링 기본 가이드를 정리한 표

- 명확하고 구체적인 요청
- 모델의 이해를 돕는 배경정보 제공
- 간결하고 직관적인 문장 사용
- 적절한 예시 사용
- 다단계 질문 피하기
- LLM 의 한계 이해
- LLM 의 역할 부여

### 프롬프트 엔지니어링의 기술

- 제로-샷 프롬프트
- 퓨-샷 프롬프트
- 역할 부여 프롬프트
- 스탭-백 프롬프트
- 생각의 사슬 프롬프트
- 자기 일관성

### 제로-샷 프롬프트

제로-샷 프롬프트는 AI 에게 예시 없이 작업을 수행하도록 요청하는 방법이다. 이 방식은 모델이 처음부터 지시를 이해하고 실행할 수 있는 능력이 있을 경우에 사용 가능하다.

LLM 은 방대한 텍스트 데이터를 학습하여 번역 요약 분류와 같은 작업이 무엇인지 잘 알고 있다. 그렇기 떄문에 명시적인 예시 없이도 이러한 작업을 잘 처리할 수 있다.

```java

```


### 퓨-샷 프롬프트

퓨-샷 프롬프트는 LLM 에게 몇 개의 예시를 제공하여 사용자가 원하는 방식으로 출력하도록 유도하는 기법이다. 한 개의 예시를 제공하는 것을 원-샷(One-shot)이라고 한다.

LLM 은 기본적으로 많은 데이터를 학습한 상태지만 어떤 방식으로 답변해야 하는지에 대한 명확한 기준이 없다. 따라서 퓨-샷 프롬프트를 사용하면 LLM 이 사용자가 원하는 형식을 학습하고 이를 기반으로 새로운 질문에도 동일한 형식으로 답변을 할 수 있도록 구성한다.

퓨-샷 프롬프트는 원하는 출력이 구조화 되어 있을 경우 예시를 몇 개 제시함으로써 결과물의 품질을 크게 향상시킬 수 있다.

```java

```


### 역할 부여 프롬프트

LLM 에게 특정 역할이나 인물을 맡도록 지시하면 출력 결과에 영향을 미친다. 특정 정체성, 전문성 또는 관점을 부여함으로써 출력 내용의 스타일이나 톤(진지한, 유머스러운), 깊이를 조정할 수 있다.

역할을 부여함으로써 LLM 은 해당 분야의 대화 스타일로 출력하게 된다. 이러한 역할에는 전문가("당신은 경험이 풍부한 데이터 과학자 입니다"), 전문직("여행 가이드 역할을 하세요"), 또는 스타일리시한 인물("셰익스피어처럼 설명하세요")이 포함될 수 있다.

```java

```


### 스탭-백 프롬프트

스탭-백 프롬프트는 복잡한 질문을 여러 단계로 분해해, 단계별로 배경 지식을 확보하는 기법이다. 이 기법은 LLM 이 즉각적인 답변을 생성하기 전에 "한 걸음 물러나" 문제와 관련된 폭넓은 배경 지식을 갖도록 유도한다. 단계별 지룸ㄴ에 대한 답변은 다음 질문의 배경지식으로 이어지기 때문에 LLM 은 단계적으로 배경 지식을 쌓아가며 더 정확한 답변을 제공할 수 있다.

사용자가 다음과 같은 질문을 했다고 가정해 보자.

Q: 서울에서 울릉도로 갈 때 비용이 가장 적게 드는 방법은?

이것을 다음과 같이 여러 단계의 질문으로 분해할 수 있다.

단계 1: 서울에서 울릉도로 가는 교통 수단은 무엇이냐?
단계 2: 각 교통 수단의 비용은 얼마냐?
단계 3: 비용이 가장 적은 교통 수다은 무엇이냐?

단계별 질문에 대한 답변은 다음 질문의 사용자 텍스트에 포함되어 LLM 으로 전달된다.

[단계 1 처리]
서울에서 울릉도로 가는 교통수단은 무엇이냐
[단계 2 처리]
각 교통수단의 비용은 얼마냐
문맥: 단계1 답변 내용
[단계 3 처리]
비용이 가장 적은 교통수단은 무엇이냐?
문맥: 단계 1 답변 + 단계 2 답변
[최종처리]
서울에서 울릉도로 갈 때 비용이 가장 적게 드는 방법은 무엇이냐?
문맥: 단계 1답변 + 단계2답변 + 단계3답변



### 생각의 사슬 프롬프트

CoT(Chain of Thought) 프롬프트는 LLM 에게 문제를 해결하는 과정을 명시적으로 요청하거나 논리적인 단계로 생각하도록 요구함으로써 다단계 추론이 필요한 작업에서 성능을 향상시킬 수 있다.

CoT 는 모델이 최종 답을 도출하기 전에 중간 추론 단계를 생성하도록 유도한다. 이는 인간이 복잡한 문제를 해결하는 방식과 유사하며 모델의 사고 과정을 명확하게 마늗ㄹ고 더 정확한 결론에 도달할 수 있도록 돕는다.

프롬프트에 "한 걸음씩 생각해 봅시다. (Let's think step by step)" 이라는 핵심 문구를 넣어 모델이 자신의 사고 과정을 보여주도록 유도한다. 추가적으로 Few-Shot 예시를 제공해 주면 사고 과정이 명확해지고 정답을 도출할 확률이 높아진다.

CoT 는 특히 복잡한 수학 문제에 유용하다. 각 단계의 추론을 명확히 함으로써 오류를 줄이는 데 도움이 된다.

```java

```

### 자기 일관성

자기 일관성(Self Consistency)는 LLM 에게 여러번 요청해서 얻은 응답을 집계하여 다수결로 최종 응답을 정하는 기법이다. 즉 LLM 이 일관성 있게 응답하는 것을 채택하는 것이다. 이 기법은 LLM 출력의 변동성을 해결해준다.

```java

```
