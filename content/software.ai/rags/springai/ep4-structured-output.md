---
title: "episode 4: structured output"
author: oscar.rs
date: 2025-09-13
tags: ["ai", "spring", "spring-ai", "structured output"]
---

# 구조화 된 출력 변환기

구조화된 출력(Structured Output)이란 데이터의 의미와 관계를 고려해서 JSON 과 같은 형식으로 출력하는 것을 말한다. LLM 의 구조화된 출력 기능은 데이터를 전달하거나 처리하는 애플리케이션 관점에서는 매우 중요하다. 일반적으로 LLM 의 출력은 텍스트 문장 입니다. LLM 이 구조화된 출력을 하려면 프롬프트에 출력 형식 지침을 포함시켜 올바른 JSON 을 출력하도록 유도해야 한다.

Spring AI 는 이러한 작업을 할 수 있도록 구조화된 출력 변환기를 제공한다. 구조화된 출력 변환기의 공통 인터페이스는 `StructuredOutputConverter<T>` 다. 이 인터페이스는 출력 형식 지침을 제공하는 `FormatProvider` 와 LLM 출력 텍스트를 `T` 객체로 변환하는 `Converter<String, T>` 를 상속한다.

```java
public interface StructuredOutputConverter<T> extends FormatProvider, Converter<String, T> {}
```

- `FormatProvider`: LLM 의 출력을 T 타입으로 변환할 수 있도록 출력 형식 지침을 제공한다. 출력 형식 지침은 PromptTemplate 을 사용하여 사용자 메세지(Raw Data) 뒤에 추가된다.
- `Converter<String, T>`: 출력 형식 지침에 맞게 LLM 이 출력하게 되면(Raw Output), T 객체로 변환하는 역할을 한다.

# Spring AI 의 `StructuredOutputConverter<T>`

- ListOutputConverter
  - FormatProvider:
  - Converter
- BeanOutputConverter
  - FormatProvider:
  - Converter
- MapOutputConverter
  - FormatProvider:
  - Converter



# List<String> 으로 변환 (ListOutputConverter)

# T로 변환(BeanOutputConverter)

# List<T> 로 변환(BeanOutputConverter)

# Map 으로 변환: MapOutputConverter

# 시스템 메세지와 함께 사용
