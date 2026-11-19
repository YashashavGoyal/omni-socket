# OmniSocket API & Event Contract Specification

## 1. Handshake & Authentication Protocol

OmniSocket supports **Dual-Mode Authentication** for WebSocket connections:
1. **Server Mode**: For backend microservices, workers, and administrative scripts using master credentials.
2. **Client Mode**: For frontend browsers, mobile, and desktop apps using short-lived ephemeral connection tokens.

---

### A. Ephemeral Client Connection Tokens (Frontend / Untrusted Clients)

To prevent exposing tenant master API keys in frontend JavaScript bundles or DevTools network tabs, tenant backends mint a short-lived token via REST.

#### 1. Minting a Client Token (Backend-to-Server)
* **POST** `/api/v1/auth/tokens`
* **Headers**:
  ```http
  x-application-id: ourtime
  x-api-key: <TENANT_MASTER_API_KEY>
  Content-Type: application/json
  ```
* **Request Body**:
  ```json
  {
    "userId": "user_456",
    "ttlSeconds": 900,
    "grants": {
      "allowedRooms": ["lobby", "room:101"],
      "canPublish": true
    },
    "metadata": {
      "username": "Alex",
      "role": "moderator"
    }
  }
  ```
* **Success Response (`201 Created`)**:
  ```json
  {
    "status": "success",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "tokenType": "Bearer",
      "expiresAt": "2026-11-20T00:00:00.000Z",
      "expiresInSeconds": 900
    }
  }
  ```

#### 2. Client WebSocket Handshake Payload
The client connects using the minted token:
```json
{
  "auth": {
    "type": "client",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### B. Server Mode Handshake (Backend Microservices / Daemons)
```json
{
  "auth": {
    "type": "server",
    "applicationId": "ourtime",
    "apiKey": "ourtime_secret_key_v1",
    "userId": "backend_worker"
  }
}
```

---

### C. Handshake Rejection Errors
If authentication fails, the connection is immediately terminated with a `connect_error` event:
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "Authentication failed: Invalid or expired client connection token"
}
```

---

## 2. Developer Client SDK (`OmniSocketClient`)

The official TypeScript SDK supports both authentication modes seamlessly:

### Client Mode with Dynamic `tokenProvider` (Browser / Frontend)
```typescript
import { OmniSocketClient, CONNECTION_TYPE } from 'omni-socket-sdk';

const client = new OmniSocketClient({
  url: 'https://socket.yourdomain.com',
  type: CONNECTION_TYPE.CLIENT,
  tokenProvider: async () => {
    // Calls client's own backend where master API key is safely stored
    const res = await fetch('/api/realtime-token');
    const { token } = await res.json();
    return token;
  }
});

await client.connect();
```
*Note: With `tokenProvider`, when Socket.IO reconnects (e.g. laptop wake-up, wifi change), the SDK automatically fetches a fresh token before re-handshaking!*

### Server Mode with Master Credentials (Backend Worker)
```typescript
import { OmniSocketClient, CONNECTION_TYPE } from 'omni-socket-sdk';

const client = new OmniSocketClient({
  url: 'https://socket.yourdomain.com',
  type: CONNECTION_TYPE.SERVER,
  applicationId: 'ourtime',
  apiKey: process.env.OMNI_API_KEY!,
  userId: 'worker_node_1'
});

await client.connect();
```

---

## 3. WebSocket Event API Specs

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
*Note: If client token specifies `grants.allowedRooms`, joining rooms outside that list returns `403 FORBIDDEN`.*

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
    "event": "chat:message",
    "data": { "text": "Hello!" },
    "includeSelf": false
  }
  ```
*Note: If client token specifies `grants.canPublish === false`, broadcasting returns `403 FORBIDDEN`.*

---

### B. Presence Subsystem (`presence`)

#### 1. Update Presence (`presence:update`)
* **Emit**: `presence:update`
* **Payload**:
  ```json
  {
    "roomId": "call-101",
    "status": "online",
    "customStatusMessage": "Focusing"
  }
  ```

#### 2. Heartbeat Ping (`presence:ping`)
* **Emit**: `presence:ping`
* **ACK Response**:
  ```json
  {
    "status": "success",
    "timestamp": "2026-11-20T00:00:00.000Z"
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
    "payload": {
      "text": "Hello world!"
    }
  }
  ```

---

## 4. Operational REST Probes

### 1. Liveness Probe
* **GET** `/health/live`
* **Response**: `200 OK`
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-20T00:00:00.000Z",
    "uptimeSeconds": 3600.5
  }
  ```

### 2. Readiness Probe
* **GET** `/health/ready`
* **Response**: `200 OK`
  ```json
  {
    "status": "ready",
    "timestamp": "2026-11-20T00:00:00.000Z",
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
    "timestamp": "2026-11-20T00:00:00.000Z",
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
