---
title: "[Redis] 25. 메시지 큐 패턴 — List, Stream, Pub/Sub 비교"
author: oscar.rs
date: 2026-03-23
tags: ["redis", "message-queue", "list", "stream", "pub-sub", "작업큐"]
---

# 메시지 큐 패턴 — List, Stream, Pub/Sub 비교

## Redis 큐 방식 비교

| | List (BLPOP) | Stream (XREADGROUP) | Pub/Sub |
|--|-------------|---------------------|---------|
| 메시지 보존 | 소비 후 삭제 | 설정 기간 보존 | 없음 |
| Consumer Group | 없음 | 있음 | 없음 |
| 재처리 | 어려움 | 가능 (Pending) |불가 |
| 브로드캐스트 | 없음 | 없음 | 있음 |
| 순서 보장 | 있음 | 있음 | 있음 |
| 적합 | 간단한 작업 큐 | 신뢰성 있는 큐 | 실시간 이벤트 |

---

## List 기반 작업 큐

### 기본 패턴

```bash
# Producer: 오른쪽에 추가
RPUSH queue:email '{"to":"alice@...","subject":"Welcome"}'

# Consumer: 왼쪽에서 blocking pop
BLPOP queue:email 30   # 30초 대기

# 우선순위 큐 (여러 큐 순서대로 확인)
BLPOP queue:urgent queue:normal queue:low 30
```

```kotlin
// Producer
@Service
class EmailQueueProducer(private val redis: StringRedisTemplate) {
    fun enqueue(emailTask: EmailTask) {
        redis.opsForList().rightPush(
            "queue:email",
            emailTask.toJson()
        )
    }
}

// Consumer
@Component
class EmailQueueConsumer(private val redis: StringRedisTemplate) {

    @Scheduled(fixedDelay = 100)
    fun process() {
        val result = redis.opsForList().leftPop(
            "queue:email",
            Duration.ofSeconds(5)
        ) ?: return

        val task = result.toEmailTask()
        emailService.send(task)
    }
}
```

### 안전한 큐 (Reliable Queue)

처리 중 서버가 죽으면 메시지 유실 방지.

```kotlin
@Service
class ReliableQueueService(private val redis: StringRedisTemplate) {

    private val mainQueue = "queue:tasks"
    private val processingQueue = "queue:tasks:processing"

    fun consume(): String? {
        // 메인 큐 → 처리 중 큐로 원자적 이동
        return redis.opsForList().move(
            ListOperations.MoveFrom.fromHead(mainQueue),
            ListOperations.MoveTo.toTail(processingQueue),
            Duration.ofSeconds(5),
        )
    }

    fun ack(message: String) {
        // 처리 완료 → 처리 중 큐에서 제거
        redis.opsForList().remove(processingQueue, 1, message)
    }

    // 서버 재시작 시 처리 중 큐 복구
    @EventListener(ApplicationReadyEvent::class)
    fun recoverOnStartup() {
        var task = redis.opsForList().rightPopAndLeftPush(
            processingQueue, mainQueue
        )
        while (task != null) {
            task = redis.opsForList().rightPopAndLeftPush(
                processingQueue, mainQueue
            )
        }
    }
}
```

---

## Stream 기반 신뢰성 있는 큐

```kotlin
@Service
class TaskStreamService(private val redis: StringRedisTemplate) {

    private val streamKey = "stream:tasks"
    private val groupName = "task-processors"
    private val consumerName = "worker-${UUID.randomUUID()}"

    @PostConstruct
    fun init() {
        try {
            redis.opsForStream<String, String>().createGroup(
                streamKey, ReadOffset.latest(), groupName
            )
        } catch (e: Exception) {
            // 그룹 이미 존재
        }
    }

    // 메시지 발행
    fun publish(task: Task) {
        redis.opsForStream<String, String>().add(
            streamKey,
            mapOf(
                "taskType" to task.type,
                "payload" to task.payload.toJson(),
                "createdAt" to Instant.now().toString(),
            )
        )
    }

    // 메시지 소비
    fun consume(batchSize: Int = 10): List<Task> {
        val messages = redis.opsForStream<String, String>().read(
            Consumer.from(groupName, consumerName),
            StreamReadOptions.empty().count(batchSize.toLong()).block(Duration.ofSeconds(5)),
            StreamOffset.create(streamKey, ReadOffset.lastConsumed()),
        ) ?: return emptyList()

        return messages.flatMap { record ->
            record.value.entries.map { (_, value) ->
                value.toTask().also {
                    // 처리 완료 ACK
                    redis.opsForStream<String, String>().acknowledge(
                        streamKey, groupName, record.id
                    )
                }
            }
        }
    }

    // 미처리(Pending) 메시지 재처리
    fun recoverPendingMessages() {
        val pending = redis.opsForStream<String, String>().pending(
            streamKey, groupName, Range.unbounded<RecordId>(), 100
        )

        pending?.forEach { pendingMessage ->
            if (pendingMessage.totalDeliveryCount > 3) {
                // 3번 이상 실패 → DLQ로
                moveToDlq(pendingMessage.id.value)
            } else if (pendingMessage.elapsedTimeSinceLastDelivery > Duration.ofMinutes(5)) {
                // 5분 이상 처리 안 됨 → 재할당
                redis.opsForStream<String, String>().claim(
                    streamKey, groupName, consumerName,
                    Duration.ofMinutes(5),
                    pendingMessage.id,
                )
            }
        }
    }
}
```

---

## 지연 큐 (Delayed Queue)

Sorted Set으로 실행 시각 기반 지연 큐 구현.

```kotlin
@Service
class DelayedQueueService(private val redis: StringRedisTemplate) {

    private val queueKey = "delayed-queue"

    // 지연 후 실행될 작업 추가
    fun addDelayed(task: Task, delaySeconds: Long) {
        val executeAt = Instant.now().plusSeconds(delaySeconds).epochSecond.toDouble()
        redis.opsForZSet().add(queueKey, task.toJson(), executeAt)
    }

    // 실행 시각이 된 작업 가져오기
    @Scheduled(fixedDelay = 1000)
    fun processDelayed() {
        val now = Instant.now().epochSecond.toDouble()

        // score <= now인 항목 가져오기 (Lua로 원자적 pop)
        val script = """
            local tasks = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, 10)
            if #tasks > 0 then
                redis.call('ZREM', KEYS[1], unpack(tasks))
            end
            return tasks
        """.trimIndent()

        val tasks = redis.execute(
            RedisScript.of(script, List::class.java),
            listOf(queueKey),
            now.toString(),
        ) as? List<String> ?: return

        tasks.forEach { taskJson ->
            processTask(taskJson.toTask())
        }
    }
}
```

---

## 데드 레터 큐 (DLQ)

```kotlin
@Service
class TaskConsumerWithDlq(private val redis: StringRedisTemplate) {

    private val maxRetries = 3
    private val retryKey = "retry-count"

    fun processWithRetry(task: Task) {
        val taskId = task.id
        val retryCount = redis.opsForHash<String, String>()
            .get(retryKey, taskId)?.toInt() ?: 0

        try {
            processTask(task)
            // 성공 → retry count 삭제
            redis.opsForHash<String, String>().delete(retryKey, taskId)
        } catch (e: Exception) {
            if (retryCount >= maxRetries) {
                // DLQ로 이동
                redis.opsForList().rightPush("queue:dlq", task.toJson())
                redis.opsForHash<String, String>().delete(retryKey, taskId)
                logger.error("DLQ로 이동: $taskId", e)
            } else {
                // 재시도 큐에 다시 추가 (지수 백오프)
                val delay = 2.0.pow(retryCount.toDouble()).toLong()
                redis.opsForZSet().add(
                    "queue:retry",
                    task.toJson(),
                    (Instant.now().epochSecond + delay).toDouble()
                )
                redis.opsForHash<String, String>().put(
                    retryKey, taskId, (retryCount + 1).toString()
                )
            }
        }
    }
}
```

---

## 정리

| 패턴 | 구현 | 적합한 경우 |
|------|------|------------|
| 기본 작업 큐 | List + BLPOP | 간단한 비동기 작업 |
| 안전한 큐 | List + RPOPLPUSH | 처리 중 장애 허용 필요 |
| 신뢰성 큐 | Stream + Consumer Group | ACK, 재처리, 여러 워커 |
| 지연 큐 | ZSet + 타임스탬프 | 스케줄링, 재시도 |
| DLQ | List (별도) | 실패 메시지 분리 처리 |
| 브로드캐스트 | Pub/Sub | 실시간 이벤트 전파 |
