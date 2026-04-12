---
title: "세션 캐싱 패턴"
date: 2026-04-12
tags: [cache, session, redis, jwt, authentication]
---

## 세션 저장소로 Redis

```
기존: 서버 메모리에 세션 저장
  → 로드밸런서가 다른 서버로 요청 → 세션 없음 → 로그아웃

Redis 세션:
  → 모든 서버가 같은 Redis에서 세션 조회
  → 로드밸런서 무관하게 세션 유지
```

---

## Spring Session + Redis

```xml
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
```

```java
@Configuration
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 3600)
public class SessionConfig {
    // Spring Session이 자동으로 Redis에 세션 저장/조회
}

// 컨트롤러에서 일반 HttpSession처럼 사용
@PostMapping("/login")
public ResponseEntity<?> login(HttpSession session, @RequestBody LoginRequest req) {
    User user = authService.authenticate(req);
    session.setAttribute("userId", user.getId());
    session.setAttribute("roles", user.getRoles());
    return ResponseEntity.ok(user);
}

@GetMapping("/profile")
public ResponseEntity<?> getProfile(HttpSession session) {
    Long userId = (Long) session.getAttribute("userId");
    // Redis에서 자동으로 세션 조회
    return ResponseEntity.ok(userService.findById(userId));
}
```

**저장되는 키:** `spring:session:sessions:{session-id}`

---

## 직접 구현 (JWT + Redis 블랙리스트)

JWT는 Stateless지만 로그아웃 처리가 어렵습니다. Redis로 해결합니다:

```python
import jwt
import uuid
from datetime import datetime, timedelta

SECRET_KEY = "your-secret"

def create_token(user_id: int) -> dict:
    """JWT 발급 + Redis에 유효한 토큰 등록"""
    jti = str(uuid.uuid4())  # JWT ID
    exp = datetime.utcnow() + timedelta(hours=1)

    token = jwt.encode({
        "sub": str(user_id),
        "jti": jti,
        "exp": exp
    }, SECRET_KEY, algorithm="HS256")

    # Redis에 유효 토큰 등록
    redis.setex(f"token:valid:{jti}", 3600, str(user_id))

    return {"token": token, "expires_at": exp.isoformat()}

def verify_token(token: str) -> int | None:
    """토큰 검증 + Redis에서 유효성 확인"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        jti = payload["jti"]

        # Redis에 없으면 로그아웃된 토큰
        user_id = redis.get(f"token:valid:{jti}")
        if not user_id:
            return None

        return int(user_id)
    except jwt.PyJWTError:
        return None

def logout(token: str):
    """로그아웃: Redis에서 토큰 제거"""
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    redis.delete(f"token:valid:{payload['jti']}")
```

---

## 세션 데이터 구조

```python
# 세션에 저장할 데이터
SESSION_DATA = {
    "user_id": 42,
    "email": "alice@example.com",
    "roles": ["user", "premium"],
    "login_at": "2026-04-12T10:00:00Z",
    "device": "Chrome/Mac",
    "ip": "1.2.3.4"
}

def create_session(user_id: int, metadata: dict) -> str:
    session_id = str(uuid.uuid4())
    session_data = {
        "user_id": user_id,
        **metadata,
        "created_at": time.time()
    }
    redis.setex(f"session:{session_id}", 86400, json.dumps(session_data))
    return session_id

def get_session(session_id: str) -> dict | None:
    data = redis.get(f"session:{session_id}")
    if not data:
        return None
    # 접근 시마다 만료 시간 갱신 (Sliding TTL)
    redis.expire(f"session:{session_id}", 86400)
    return json.loads(data)
```

---

## 멀티 디바이스 세션 관리

```python
def get_user_sessions(user_id: int) -> list[dict]:
    """유저의 모든 세션 조회"""
    session_ids = redis.smembers(f"user:{user_id}:sessions")
    sessions = []
    for sid in session_ids:
        data = redis.get(f"session:{sid}")
        if data:
            sessions.append(json.loads(data))
        else:
            redis.srem(f"user:{user_id}:sessions", sid)  # 만료된 세션 정리
    return sessions

def logout_all_devices(user_id: int):
    """모든 디바이스 로그아웃"""
    session_ids = redis.smembers(f"user:{user_id}:sessions")
    pipeline = redis.pipeline()
    for sid in session_ids:
        pipeline.delete(f"session:{sid}")
    pipeline.delete(f"user:{user_id}:sessions")
    pipeline.execute()
```

---

## 핵심 요약

- Redis 세션: 분산 서버에서 세션 공유 (로드밸런서 무관)
- Spring Session: `@EnableRedisHttpSession`으로 자동 처리
- JWT + Redis: Stateless JWT + 블랙리스트로 로그아웃 지원
- Sliding TTL: 접근 시마다 `EXPIRE` 갱신
- 멀티 디바이스: Set으로 유저별 세션 ID 목록 관리
