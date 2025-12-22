---
title: "Episode 12: Vector Store"
date: 2024-09-04
tags: ["RAG", "best practices", "ai", "langchain", "vector store"]
author: oscar.rs
---

# Vector store

임베딩으로 생성한 벡터 데이터를 벡터 스토어에 저장하기 위해 사용한다. 벡터 스토어는 임베딩 벡터를 효과적으로 저장하고 색인화하여 대량의 데이터에서도 관련 정보를 빠르게 검색할 수 있게 한다.

또한 데이터 증가에 따라 확장 가능한 저장 구조를 통해 대규모 데이터를 성능 저하 없이 관리할 수 있는 확장성을 보장한다.

사용자의 질문과 의미적으로 유사한 단락을 조회할 수 있는 의미론적 검색(semantic search)를 지원한다.

# 벡터 데이터베이스의 종류

### Chroma

### FAISS

### Pinecone

Pinecone 은 클라우드 기반의 고성능 벡터 데이터베이스이다. 다른 벡터 데이터베이스는 대용량 문서를 로드할 때 처리 속도가 느려지는 단점이 있으나 Pinecone 은 Write/Read 작업 시점부터 비용이 발생하므로

사용자가 늘면 그만큼 비용이 발생한다.

# Summary
