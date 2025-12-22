---
title: "Episode 11: Embeddings"
date: 2024-09-04
tags: ["RAG", "best practices", "ai", "langchain", "embeddings"]
author: oscar.rs
---

# Preface


# Embedding?

# 왜 Embedding 을 사용해야할까?

첫번째로는 다국어 지원과 준수한 성능 때문이다. OpenAI 임베딩은 한국어를 포함한 여러 언어에서 상식적으로 타당한 수준의 결과를 내놓는다.

특히 유사도를 계산한 결과와 기대치가 일치하는 수준으로 정확도가 안정적이다.

두번째로는 하드웨어 자원의 효율적 사용이다. 임베딩을 처리하기 위해서는 많은 하드웨어 리소스가 필요하다.

특히 고성능 임베딩 모델은 크기가 크고, GPU 자원이 필요해 일반 랩톱에서는 실행하기 어렵다. 이럴때 OpenAI 임베딩 AI 를 사용하면 OpenAI 가 제공하는 서버 자원을 활용하여 임베딩을 처리할 수 있으므로 고성능 하드웨어 없이도 작업을 원할히 진행할 수 있다.

> [!INFO] OpenAI 임베딩 말고도 Hugging Face, Upstage, Ollama 의 오픈소스 임베딩 모델도 사용할 수 있습니다.

# Langchain 에서 지원하는 Embedding APIs

### OpenAI Embeddings

### CacheBackedEmbeddings

### HuggingFaceEmbeddings

### Upstage Embeddings

### Ollama Embeddings

# Summary
