---
title: "Spring Boot: 메시징 — RabbitMQ, Kafka, JMS"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-boot", "rabbitmq", "kafka", "messaging"]
---

# 메시징

## Spring AMQP (RabbitMQ)

### 의존성 & 설정

```kotlin
implementation("org.springframework.boot:spring-boot-starter-amqp")
```

```yaml
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: guest
    password: guest
    virtual-host: /
    listener:
      simple:
        acknowledge-mode: manual  # 수동 ACK
        prefetch: 1               # 한 번에 처리할 메시지 수
```

### Exchange / Queue / Binding 선언

```java
@Configuration
public class RabbitConfig {

    // Direct Exchange: routingKey가 정확히 일치하는 큐로 전달
    @Bean
    public DirectExchange orderExchange() {
        return new DirectExchange("order.exchange");
    }

    // 주문 처리 큐
    @Bean
    public Queue orderQueue() {
        return QueueBuilder.durable("order.queue")
            .withArgument("x-dead-letter-exchange", "order.dlx")  // DLQ 설정
            .withArgument("x-dead-letter-routing-key", "order.dead")
            .withArgument("x-message-ttl", 60000)  // 60초 TTL
            .build();
    }

    @Bean
    public Binding orderBinding() {
        return BindingBuilder.bind(orderQueue()).to(orderExchange()).with("order.created");
    }

    // Dead Letter Exchange & Queue
    @Bean
    public DirectExchange orderDlx() {
        return new DirectExchange("order.dlx");
    }

    @Bean
    public Queue orderDeadQueue() {
        return QueueBuilder.durable("order.dead.queue").build();
    }

    @Bean
    public Binding orderDeadBinding() {
        return BindingBuilder.bind(orderDeadQueue()).to(orderDlx()).with("order.dead");
    }

    // Jackson 직렬화
    @Bean
    public MessageConverter jackson2MessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public AmqpTemplate amqpTemplate(ConnectionFactory factory) {
        RabbitTemplate template = new RabbitTemplate(factory);
        template.setMessageConverter(jackson2MessageConverter());
        return template;
    }
}
```

### 메시지 발행

```java
@Service
@RequiredArgsConstructor
public class OrderEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishOrderCreated(OrderCreatedEvent event) {
        rabbitTemplate.convertAndSend("order.exchange", "order.created", event);
    }

    // 지연 메시지 (RabbitMQ Delayed Message Plugin 필요)
    public void publishDelayed(OrderCreatedEvent event, long delayMs) {
        rabbitTemplate.convertAndSend("order.exchange", "order.created", event, message -> {
            message.getMessageProperties().setDelay((int) delayMs);
            return message;
        });
    }
}
```

### 메시지 소비

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderEventConsumer {

    private final OrderProcessingService processingService;

    @RabbitListener(queues = "order.queue")
    public void handleOrderCreated(OrderCreatedEvent event, Channel channel,
                                   @Header(AmqpHeaders.DELIVERY_TAG) long tag) throws Exception {
        try {
            processingService.process(event);
            channel.basicAck(tag, false);  // 처리 성공: ACK
        } catch (BusinessException e) {
            log.warn("Business error processing order {}: {}", event.orderId(), e.getMessage());
            channel.basicNack(tag, false, false);  // DLQ로 이동
        } catch (Exception e) {
            log.error("Unexpected error processing order {}", event.orderId(), e);
            channel.basicNack(tag, false, true);   // 재큐잉
        }
    }
}
```

---

## Spring Kafka

### 의존성 & 설정

```kotlin
implementation("org.springframework.kafka:spring-kafka")
```

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      acks: all         # 모든 ISR 확인 (신뢰성 최대)
      retries: 3
    consumer:
      group-id: my-service
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      auto-offset-reset: earliest
      enable-auto-commit: false  # 수동 커밋
      properties:
        spring.json.trusted.packages: "com.example.*"
    listener:
      ack-mode: manual_immediate
```

### 메시지 발행

```java
@Service
@RequiredArgsConstructor
public class KafkaOrderProducer {

    private final KafkaTemplate<String, OrderCreatedEvent> kafkaTemplate;

    public void sendOrderCreated(OrderCreatedEvent event) {
        kafkaTemplate.send("order-created", event.orderId().toString(), event)
            .thenAccept(result -> log.info("Sent order {} to partition {}",
                event.orderId(), result.getRecordMetadata().partition()))
            .exceptionally(ex -> {
                log.error("Failed to send order {}", event.orderId(), ex);
                return null;
            });
    }

    // 트랜잭션 발행 (Exactly-once)
    @Transactional("kafkaTransactionManager")
    public void sendWithTransaction(List<OrderCreatedEvent> events) {
        events.forEach(event ->
            kafkaTemplate.send("order-created", event.orderId().toString(), event)
        );
    }
}
```

### 메시지 소비

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaOrderConsumer {

    @KafkaListener(
        topics = "order-created",
        groupId = "order-processor",
        concurrency = "3"  // 파티션 수만큼 병렬 소비
    )
    public void handleOrderCreated(
        @Payload OrderCreatedEvent event,
        @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
        @Header(KafkaHeaders.OFFSET) long offset,
        Acknowledgment acknowledgment
    ) {
        log.info("Processing order {} from partition {} offset {}", event.orderId(), partition, offset);
        try {
            orderProcessingService.process(event);
            acknowledgment.acknowledge();  // 수동 커밋
        } catch (Exception e) {
            log.error("Failed to process order {}", event.orderId(), e);
            // 재처리 로직 또는 DLT로 전송
        }
    }

    // 배치 소비
    @KafkaListener(topics = "order-analytics", containerFactory = "batchListenerContainerFactory")
    public void handleBatch(List<OrderCreatedEvent> events, Acknowledgment acknowledgment) {
        log.info("Batch processing {} events", events.size());
        analyticsService.processBatch(events);
        acknowledgment.acknowledge();
    }
}
```

### 에러 처리 & DLT

```java
@Configuration
public class KafkaErrorConfig {

    @Bean
    public DefaultErrorHandler errorHandler(KafkaTemplate<?, ?> template) {
        // 실패한 메시지를 Dead Letter Topic으로 전송
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(template,
            (record, ex) -> new TopicPartition(record.topic() + ".DLT", record.partition())
        );

        // 지수 백오프: 1초, 2초, 4초 재시도 후 DLT로
        ExponentialBackOff backOff = new ExponentialBackOff(1000L, 2.0);
        backOff.setMaxAttempts(3);

        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backOff);
        handler.addNotRetryableExceptions(BusinessException.class);  // 즉시 DLT
        return handler;
    }
}
```

---

## RabbitMQ vs Kafka 선택 기준

| 항목 | RabbitMQ | Kafka |
|---|---|---|
| 메시지 순서 | 큐 단위 보장 | 파티션 단위 보장 |
| 처리량 | 중간 (수만 msg/s) | 높음 (수십만 msg/s) |
| 메시지 보존 | 소비 후 삭제 | 설정된 기간 보존 |
| 재처리 | DLQ에서 수동 재처리 | 오프셋 리셋으로 재처리 |
| 라우팅 | 다양한 Exchange 패턴 | 토픽/파티션 |
| 적합한 사례 | 작업 큐, RPC, 복잡한 라우팅 | 이벤트 스트리밍, 로그 수집, 대용량 |

---

## Spring JMS (ActiveMQ)

```yaml
spring:
  activemq:
    broker-url: tcp://localhost:61616
    user: admin
    password: admin
```

```java
@Service
@RequiredArgsConstructor
public class JmsMessageService {

    private final JmsTemplate jmsTemplate;

    public void send(String destination, Object message) {
        jmsTemplate.convertAndSend(destination, message);
    }
}

@Component
public class JmsMessageConsumer {

    @JmsListener(destination = "order.queue")
    public void handleMessage(OrderCreatedEvent event) {
        orderProcessingService.process(event);
    }
}
```
