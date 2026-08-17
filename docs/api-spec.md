# OmniSocket API & Event Contract Specification

## 1. Handshake & Authentication Protocol

Clients must connect via Socket.IO transport and supply authentication credentials in the initial handshake `auth` payload.

### Handshake Payload Schema
```json
{
  "auth": {
    "applicationId": "ourtime",
    "apiKey": "ourtime_secret_key_v1",
    "userId": "alice_123"
  }
}
```

### Handshake Rejection Errors
If authentication fails, the connection is immediately terminated with a `connect_error` event:
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "Authentication failed: Invalid application credentials"
}
```

---

## 2. WebSocket Event API Specs

### A. Room Subsystem (`rooms`)

#### 1. Join Room (`room:join`)
* **Emit**: `room:join`
* **Payload**:
  ```json
  {
    "roomId": "call-101"
  }
  ```
* **ACK Response** / **Event (`room:joined`)**:
  ```json
  {
    "status": "success",
    "event": "room:joined",
    "roomId": "call-101",
    "scopedRoomKey": "ourtime:call-101"
  }
  ```

#### 2. Leave Room (`room:leave`)
* **Emit**: `room:leave`
* **Payload**:
  ```json
  {
    "roomId": "call-101"
  }
  ```
* **ACK Response** / **Event (`room:left`)**:
  ```json
  {
    "status": "success",
    "event": "room:left",
    "roomId": "call-101"
  }
  ```

#### 3. Room Broadcast (`room:broadcast`)
* **Emit**: `room:broadcast`
* **Payload**:
  ```json
  {
    "roomId": "call-101",
    "event": "signal:offer",
    "data": {
      "sdp": "v=0\r\no=- 123456...",
      "type": "offer"
    }
  }
  ```
* **Received by Peer Clients in Room**: Event `signal:offer` with payload `{ "sdp": "..." }`.

---

### B. Presence & Heartbeat Subsystem (`presence`)

#### 1. Update Status (`presence:update`)
* **Emit**: `presence:update`
* **Payload**:
  ```json
  {
    "roomId": "call-101",
    "status": "busy",
    "customStatusMessage": "In a meeting"
  }
  ```
* **Broadcast to Room (`presence:changed`)**:
  ```json
  {
    "userId": "alice_123",
    "applicationId": "ourtime",
    "status": "busy",
    "customStatusMessage": "In a meeting",
    "activeSocketsCount": 1,
    "lastSeenAt": "2026-08-18T01:00:00.000Z"
  }
  ```

#### 2. Heartbeat Ping (`presence:ping`)
* **Emit**: `presence:ping`
* **ACK Response**:
  ```json
  {
    "status": "success",
    "event": "presence:pong",
    "lastSeenAt": "2026-08-18T01:00:05.000Z"
  }
  ```

---

### C. Generic Event Router Subsystem (`events`)

#### Emit Custom Event (`event:emit`)
* **Emit**: `event:emit`
* **Payload**:
  ```json
  {
    "targetType": "room",
    "targetId": "call-101",
    "eventName": "chat:message",
    "data": {
      "text": "Hello world!"
    }
  }
  ```

---

## 3. Operational REST Probes

### 1. Liveness Probe
* **GET** `/health/live`
* **Response**: `200 OK`
  ```json
  {
    "status": "ok",
    "timestamp": "2026-08-18T01:00:00.000Z",
    "uptimeSeconds": 3600.5
  }
  ```

### 2. Readiness Probe
* **GET** `/health/ready`
* **Response**: `200 OK`
  ```json
  {
    "status": "ready",
    "timestamp": "2026-08-18T01:00:00.000Z",
    "subsystems": {
      "socketIO": "healthy",
      "connectionRegistry": "healthy",
      "applicationRepository": "healthy"
    }
  }
  ```

### 3. Metrics Probe
* **GET** `/health/metrics`
* **Response**: `200 OK`
  ```json
  {
    "status": "ok",
    "timestamp": "2026-08-18T01:00:00.000Z",
    "uptimeSeconds": 3600.5,
    "connections": {
      "activeSockets": 42
    },
    "rooms": {
      "totalRooms": 10
    },
    "memory": {
      "heapUsedMb": 24.5,
      "heapTotalMb": 48.0,
      "rssMb": 98.2
    }
  }
  ```
