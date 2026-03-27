---
title: "Spring Cloud Gateway: 고급 설정 (TLS, WebSocket, HTTP/2)"
author: oscar.rs
date: 2026-03-27
tags: ["spring", "spring-cloud-gateway", "tls", "websocket", "http2"]
---

## TLS/HTTPS 설정

### 기본 TLS 설정

```yaml
server:
  port: 8443
  ssl:
    enabled: true
    key-store: classpath:keystore.p12       # 키스토어 위치
    key-store-password: ${SSL_KEYSTORE_PASSWORD}
    key-store-type: PKCS12
    key-alias: gateway                      # 인증서 별칭
    # 클라이언트 인증서 검증 (mTLS)
    client-auth: none                       # none | want | need
```

### 자체 서명 인증서 생성 (개발 환경)

```bash
# keytool로 자체 서명 인증서 생성
keytool -genkeypair \
  -alias gateway \
  -keyalg RSA \
  -keysize 2048 \
  -validity 365 \
  -storetype PKCS12 \
  -keystore keystore.p12 \
  -storepass changeit \
  -dname "CN=localhost, OU=Dev, O=Example, L=Seoul, ST=Seoul, C=KR"

# 인증서 내보내기 (클라이언트 신뢰 설정용)
keytool -exportcert \
  -alias gateway \
  -keystore keystore.p12 \
  -storepass changeit \
  -file gateway.crt \
  -rfc

# 인증서 정보 확인
keytool -list -v \
  -keystore keystore.p12 \
  -storepass changeit
```

### HTTP → HTTPS 리다이렉트

```kotlin
// HttpsRedirectConfig.kt
import org.springframework.boot.web.embedded.netty.NettyReactiveWebServerFactory
import org.springframework.boot.web.server.WebServerFactoryCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.web.server.WebFilter
import reactor.core.publisher.Mono

@Configuration
class HttpsRedirectConfig {

    // HTTP(8080)에서 HTTPS(8443)로 리다이렉트
    @Bean
    fun httpsRedirectFilter(): WebFilter {
        return WebFilter { exchange, chain ->
            val request = exchange.request
            if (request.uri.scheme == "http") {
                val httpsUri = request.uri
                    .toString()
                    .replace("http://", "https://")
                    .replace(":8080", ":8443")

                exchange.response.apply {
                    statusCode = HttpStatus.MOVED_PERMANENTLY
                    headers.location = java.net.URI.create(httpsUri)
                }
                Mono.empty()
            } else {
                chain.filter(exchange)
            }
        }
    }
}
```

### 하위 서비스 SSL 신뢰 설정

```yaml
spring:
  cloud:
    gateway:
      httpclient:
        ssl:
          # 개발 환경: 자체 서명 인증서 허용 (운영에서는 절대 사용 금지)
          use-insecure-trust-manager: false
          # 커스텀 트러스트스토어 설정
          trusted-x509-certificates:
            - classpath:certs/service-ca.crt
          # 핸드셰이크 타임아웃
          handshake-timeout: 10s
          # 세션 캐시 활성화
          session-cache-size: 0
          session-timeout: 0
```

### mTLS (클라이언트 인증서) 설정

```yaml
server:
  ssl:
    enabled: true
    key-store: classpath:server-keystore.p12
    key-store-password: ${SERVER_KEYSTORE_PASSWORD}
    key-store-type: PKCS12
    # 클라이언트 인증서 필수 요구
    client-auth: need
    # 신뢰할 클라이언트 인증서 CA
    trust-store: classpath:truststore.p12
    trust-store-password: ${TRUST_STORE_PASSWORD}
    trust-store-type: PKCS12
```

```kotlin
// mTLS에서 클라이언트 인증서 정보 추출
@Component
class MtlsAuthFilter : GlobalFilter, Ordered {
    override fun getOrder(): Int = -100

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        return exchange.request.sslInfo
            ?.let { sslInfo ->
                val peerCertificates = sslInfo.peerCertificates
                if (peerCertificates.isNotEmpty()) {
                    val cert = peerCertificates[0] as java.security.cert.X509Certificate
                    val clientDn = cert.subjectX500Principal.name
                    val mutatedRequest = exchange.request.mutate()
                        .header("X-Client-Cert-DN", clientDn)
                        .build()
                    chain.filter(exchange.mutate().request(mutatedRequest).build())
                } else {
                    chain.filter(exchange)
                }
            } ?: chain.filter(exchange)
    }
}
```

---

## HTTP/2

### HTTP/2 활성화

```yaml
server:
  http2:
    enabled: true
  # HTTP/2는 TLS 없이도 h2c(cleartext)로 사용 가능 (내부 통신용)
  ssl:
    enabled: true  # HTTP/2는 TLS 필수 (브라우저 환경)
```

### h2c (HTTP/2 Cleartext) — 내부 서비스 간 통신

```kotlin
// H2cConfig.kt — 하위 서비스와 HTTP/2 cleartext로 통신
import io.netty.handler.codec.http2.Http2SecurityUtil
import io.netty.handler.ssl.ApplicationProtocolConfig
import io.netty.handler.ssl.ApplicationProtocolNames
import io.netty.handler.ssl.SslContextBuilder
import io.netty.handler.ssl.SupportedCipherSuiteFilter
import org.springframework.cloud.gateway.config.HttpClientCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import reactor.netty.http.HttpProtocol

@Configuration
class HttpClientConfig {

    @Bean
    fun http2HttpClientCustomizer(): HttpClientCustomizer {
        return HttpClientCustomizer { client ->
            client.protocol(
                HttpProtocol.H2,    // HTTP/2 (TLS 필요)
                HttpProtocol.HTTP11  // HTTP/1.1 폴백
            )
        }
    }
}
```

```yaml
spring:
  cloud:
    gateway:
      httpclient:
        # 하위 서비스와 HTTP/2 사용
        http2:
          enabled: true
```

### HTTP/2 → HTTP/1.1 다운그레이드

하위 서비스가 HTTP/2를 지원하지 않는 경우:

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: legacy-service
          # 명시적으로 http:// 스킴 사용 → HTTP/1.1 강제
          uri: http://legacy-service:8080
          predicates:
            - Path=/api/legacy/**
```

---

## WebSocket 라우팅

Spring Cloud Gateway는 WebSocket을 일반 HTTP 라우트와 동일한 방식으로 설정한다. `ws://` 또는 `wss://` URI를 사용하면 자동으로 WebSocket 업그레이드를 처리한다.

### 기본 WebSocket 라우팅

```yaml
spring:
  cloud:
    gateway:
      routes:
        # HTTP와 WebSocket 동시 처리 (같은 서비스의 REST + WS)
        - id: chat-service-ws
          uri: ws://chat-service:8080
          predicates:
            - Path=/ws/chat/**

        # WSS (WebSocket over TLS)
        - id: realtime-service-wss
          uri: wss://realtime-service:8443
          predicates:
            - Path=/ws/realtime/**

        # Upgrade 헤더로 WebSocket 구분
        - id: notification-ws
          uri: ws://notification-service:8080
          predicates:
            - Path=/api/notifications/stream
            - Header=Upgrade, websocket
```

### WebSocket 핸드셰이크 헤더 전달

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: chat-ws
          uri: ws://chat-service:8080
          predicates:
            - Path=/ws/**
          filters:
            # 인증 토큰을 WebSocket 핸드셰이크 헤더로 전달
            - AddRequestHeader=X-Gateway-Forwarded, true
            # WebSocket은 쿼리 파라미터로 토큰 전달하는 경우가 많음
            # ?token=xxx → Authorization: Bearer xxx 변환
            - name: AddRequestHeader
              args:
                name: Authorization
                value: "Bearer #{T(org.springframework.web.util.UriComponentsBuilder).fromUri(exchange.request.uri).build().queryParams.getFirst('token')}"
```

### WebSocket 타임아웃 처리

WebSocket은 장시간 연결을 유지하므로 `response-timeout`을 비활성화해야 한다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: chat-ws
          uri: ws://chat-service:8080
          predicates:
            - Path=/ws/chat/**
          metadata:
            # WebSocket 연결은 response-timeout 비활성화
            response-timeout: -1
            # 연결 타임아웃은 유지
            connect-timeout: 5000
```

```kotlin
// WebSocket용 라우트 설정 (Java Config)
@Bean
fun webSocketRoute(builder: RouteLocatorBuilder): RouteLocator {
    return builder.routes()
        .route("chat-ws") { r ->
            r.path("/ws/chat/**")
                .metadata("response-timeout", -1)
                .metadata("connect-timeout", 5000)
                .uri("ws://chat-service:8080")
        }
        .build()
}
```

---

## SSE (Server-Sent Events)

SSE는 서버에서 클라이언트로 실시간 이벤트를 전송하는 단방향 스트리밍 프로토콜이다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: event-stream
          uri: http://event-service:8080
          predicates:
            - Path=/api/events/stream
          metadata:
            # SSE 스트리밍은 response-timeout 비활성화
            response-timeout: -1
```

SSE 응답의 `Content-Type`은 `text/event-stream`이며, 게이트웨이는 자동으로 버퍼링하지 않고 청크 단위로 클라이언트에 전달한다. 단, `ModifyResponseBody` 필터는 SSE와 함께 사용할 수 없다.

---

## ModifyRequestBody / ModifyResponseBody 심화

### 요청 바디 변환

```kotlin
// RequestBodyRewriteConfig.kt
import org.springframework.cloud.gateway.filter.factory.rewrite.ModifyRequestBodyGatewayFilterFactory
import org.springframework.cloud.gateway.filter.factory.rewrite.RewriteFunction
import org.springframework.cloud.gateway.route.RouteLocator
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import reactor.core.publisher.Mono

@Configuration
class BodyRewriteConfig {

    /**
     * 요청 바디 변환: 레거시 API 형식 → 신규 형식으로 변환
     */
    @Bean
    fun requestBodyRewriteRoute(builder: RouteLocatorBuilder): RouteLocator {
        return builder.routes()
            .route("order-service") { r ->
                r.path("/api/orders/**")
                    .filters { f ->
                        f.modifyRequestBody(
                            String::class.java,
                            String::class.java,
                            "application/json",
                            RewriteFunction<String, String> { exchange, originalBody ->
                                // 레거시 필드명 → 신규 필드명 변환
                                val transformed = originalBody
                                    ?.replace("\"product_id\"", "\"productId\"")
                                    ?.replace("\"user_id\"", "\"userId\"")
                                    ?: "{}"
                                Mono.just(transformed)
                            }
                        )
                    }
                    .uri("lb://order-service")
            }
            .build()
    }

    /**
     * 응답 바디 변환: JSON에 메타 정보 추가
     */
    @Bean
    fun responseBodyRewriteRoute(builder: RouteLocatorBuilder): RouteLocator {
        return builder.routes()
            .route("product-service") { r ->
                r.path("/api/products/**")
                    .filters { f ->
                        f.modifyResponseBody(
                            String::class.java,
                            String::class.java,
                            RewriteFunction<String, String> { exchange, originalBody ->
                                if (originalBody.isNullOrBlank()) {
                                    return@RewriteFunction Mono.just("{}")
                                }

                                try {
                                    // JSON 파싱 후 필드 추가
                                    val objectMapper = com.fasterxml.jackson.databind.ObjectMapper()
                                    val json = objectMapper.readTree(originalBody) as com.fasterxml.jackson.databind.node.ObjectNode

                                    // 응답에 메타 정보 추가
                                    json.put("_gateway", "spring-cloud-gateway")
                                    json.put("_timestamp", System.currentTimeMillis())
                                    json.put("_version", "v2")

                                    Mono.just(objectMapper.writeValueAsString(json))
                                } catch (e: Exception) {
                                    // JSON 파싱 실패 시 원본 반환
                                    Mono.just(originalBody)
                                }
                            }
                        )
                    }
                    .uri("lb://product-service")
            }
            .build()
    }
}
```

### 대용량 바디 처리

```yaml
spring:
  codec:
    # 기본값 256KB → 바디 크기에 따라 조정
    max-in-memory-size: 10MB

  cloud:
    gateway:
      routes:
        - id: file-upload
          uri: lb://storage-service
          predicates:
            - Path=/api/files/upload
          # ModifyRequestBody 없이 스트리밍으로 전달 (대용량 파일)
          # ModifyRequestBody 사용 시 전체 바디를 메모리에 올림 → 주의
```

### 스트리밍 응답에 ModifyResponseBody 사용 불가

`ModifyResponseBody`는 전체 응답 바디를 메모리에 버퍼링한 후 변환하는 방식이다. 따라서:

- **SSE (text/event-stream)**: 스트리밍 중에 변환 불가 → 첫 청크만 처리하거나 무한 대기
- **대용량 파일 다운로드**: `max-in-memory-size` 초과 시 오류
- **Chunked Transfer-Encoding**: 청크가 모두 수신될 때까지 응답 지연

이런 경우에는 `ModifyResponseBody` 대신 하위 서비스에서 직접 변환하거나, `GlobalFilter`에서 `HttpHeaders`만 수정하는 방식을 사용한다.

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: streaming-service
          uri: lb://streaming-service
          predicates:
            - Path=/api/stream/**
          # ModifyResponseBody 사용 금지
          # 대신 헤더만 수정
          filters:
            - AddResponseHeader=X-Gateway-Processed, true
          metadata:
            response-timeout: -1
```

---

## 실무 팁

### TLS 인증서 자동 갱신 (Let's Encrypt)

운영 환경에서는 Let's Encrypt + Certbot으로 90일마다 자동 갱신한다. Spring Boot에서는 인증서 갱신 후 재시작 없이 적용되지 않으므로, `/actuator/refresh` 엔드포인트와 연동하거나 Kubernetes `cert-manager`를 활용한다.

### WebSocket 로드밸런싱 주의사항

WebSocket은 장시간 연결을 유지하므로 일반적인 라운드로빈 로드밸런싱이 비효율적일 수 있다. WebSocket 연결이 많은 서비스는 **Sticky Session** 또는 **서비스별 WebSocket 전용 인스턴스**를 고려한다.

### HTTP/2 Push Promise 미지원

Spring Cloud Gateway는 HTTP/2 Server Push를 지원하지 않는다. Push가 필요한 경우 Nginx나 Envoy 등의 전용 프록시를 앞단에 배치한다.

### ModifyResponseBody와 Content-Length

바디를 수정하면 원본 `Content-Length` 헤더가 틀려진다. Spring Cloud Gateway는 자동으로 `Content-Length`를 제거하고 `Transfer-Encoding: chunked`로 전환한다. 클라이언트가 `Content-Length`를 필수로 요구하는 경우에는 변환 후 직접 헤더를 설정해야 한다.
