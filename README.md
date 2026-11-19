# 🚀 OmniSocket Realtime Engine (v2.0.0)

OmniSocket is a **production-ready, application-agnostic, multi-tenant WebSocket infrastructure engine** built on top of Node.js, Fastify, Socket.IO, PostgreSQL (Drizzle ORM), and TypeScript.

It serves as a standalone real-time messaging gateway for multiple client applications (e.g. video conferencing tools, chat applications, live whiteboards) with enterprise-grade security, rate limiting, presence tracking, observability, and a built-in Master Admin Management Dashboard.

---

## 🌟 Key Features

* **Multi-Tenant Isolation**: Tenant applications (`applicationId`) share a single engine with complete event and room-level state isolation.
* **Dual-Mode Handshake & Ephemeral Client Tokens**: Mint temporary scoped tokens (`POST /api/v1/auth/tokens`) so frontends never expose master API keys, with automatic SDK `tokenProvider` reconnects.
* **Glassmorphic Master Admin Dashboard**: Dedicated administrative GUI (`ADMIN_PANEL_PATH`) for tenant CRUD (Register, Edit, Rotate Key, Delete), real-time socket metrics, heap memory tracking, and health status.
* **Obfuscated Admin Path**: Protect administrative interfaces from scanners by setting a custom `ADMIN_PANEL_PATH` in `.env`.
* **Developer Client SDK**: Dedicated promise-based TypeScript SDK (`OmniSocketClient`) for seamless client integration.
* **AI-Native Self-Documentation**: `/llms.txt` and `/docs` REST endpoints with content negotiation (`Accept: text/markdown`) for AI bots & developers.
* **Dual-Tier Rate Limiting**: Socket-level (30 requests/10s) and Application-level (1000 requests/10s) sliding-window rate limit protection.
* **Granular Feature Guarding**: Enable or disable features (`rooms`, `presence`, `events`) per tenant application on the fly.
* **Presence & Heartbeat Engine**: Room-scoped status updates (`online`, `away`, `busy`, `offline`) and automated ping/pong heartbeat tracking.
* **Security & Input Sanitization**: Built-in XSS script stripping, HTML neutralization, prototype pollution prevention, and 64KB payload bounds.
* **Structured Audit Observability**: JSON log format with correlation IDs, action timing, and request tracing.
* **Graceful Teardown**: Intercepts `SIGTERM` / `SIGINT`, notifies connected clients (`server:shutdown`), flushes packets, and closes cleanly.
* **Production Containerization**: Multi-stage Dockerfile (`node:20-alpine`) with unprivileged `node` user and native Node HTTP health check probes.

---

## 💻 Master Admin Dashboard & REST APIs

OmniSocket provides both a responsive, glassmorphic GUI and a programmatic REST API for administrative operations.

### 1. Administrative Web Dashboard
* **Configurable Obscure Route**: Configured via `ADMIN_PANEL_PATH` in `.env` (protects the dashboard from scanners and bots).
* **Authentication**: Secured via `x-admin-key: <ADMIN_API_KEY>`.
* **Tenant Management**:
  * **Register**: Provision new tenant apps with name, custom slug, and feature toggles.
  * **Edit Modal**: Update application name, slug, active status, and feature flags dynamically.
  * **Rotate Key**: Instantly rotate tenant API keys while invalidating old keys.
  * **Delete**: Delete registered tenant applications.
* **System Metrics**: Real-time socket count, room count, server uptime, heap memory usage, and subsystem health checks.

### 2. Master Admin REST API Endpoints
All administrative REST endpoints strictly require the header:
```http
x-admin-key: <ADMIN_API_KEY>
```
*(Note: Under OmniSocket v2.0, administrative requests must provide `x-admin-key`. The legacy `Authorization: Bearer` fallback is disabled).*

#### A. System Overview & Metrics (`GET /api/v1/admin/stats`)
Returns system health, active connections, room count, memory usage, and registered applications.
* **Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "timestamp": "2026-11-20T00:00:00.000Z",
    "summary": {
      "totalApplications": 3,
      "activeSockets": 42,
      "totalRooms": 12,
      "uptimeSeconds": 3600
    },
    "memory": { "heapUsedMB": 45.2, "heapTotalMB": 64.0, "rssMB": 85.1 },
    "readiness": { "status": "UP", "database": "healthy", "redis": "disabled" },
    "applications": [...]
  }
  ```

#### B. Tenant Management Endpoints (`/api/v1/apps`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/apps` | List all registered tenant applications |
| `GET` | `/api/v1/apps/:id` | Get application details by primary UUID |
| `POST` | `/api/v1/apps` | Register a new tenant application |
| `PATCH` | `/api/v1/apps/:id` | Update application name, slug, enabled state, or feature flags |
| `POST` | `/api/v1/apps/:id/rotate-key` | Rotate tenant API key (invalidates previous key immediately) |
| `DELETE` | `/api/v1/apps/:id` | Delete application by primary UUID |

##### Register Application (`POST /api/v1/apps`)
* **Headers**: `x-admin-key: <ADMIN_API_KEY>`, `Content-Type: application/json`
* **Body**:
  ```json
  {
    "name": "Chat Service",
    "applicationId": "chat-service",
    "enabled": true,
    "features": {
      "presence": true,
      "rooms": true,
      "events": true
    }
  }
  ```
  *(Note: If `applicationId` is omitted, an alphanumeric slug is auto-generated from `name`. Names must contain at least one alphanumeric character).*
* **Response (`201 Created`)**:
  ```json
  {
    "status": "success",
    "message": "Application registered successfully. Store the API key safely as it will not be shown again.",
    "data": {
      "id": "b1a7d6e4-...",
      "applicationId": "chat-service",
      "name": "Chat Service",
      "enabled": true,
      "features": { "presence": true, "rooms": true, "events": true },
      "apiKey": "omni_live_abc123...",
      "createdAt": "2026-11-20T00:00:00.000Z",
      "updatedAt": "2026-11-20T00:00:00.000Z"
    }
  }
  ```

##### Update Application (`PATCH /api/v1/apps/:id`)
* **Body** (all fields optional):
  ```json
  {
    "name": "Updated Name",
    "applicationId": "new-slug",
    "enabled": false,
    "features": { "presence": false }
  }
  ```

##### Rotate API Key (`POST /api/v1/apps/:id/rotate-key`)
* **Response (`200 OK`)**:
  ```json
  {
    "status": "success",
    "message": "API key rotated successfully. Store the new API key safely.",
    "data": {
      "id": "b1a7d6e4-...",
      "applicationId": "chat-service",
      "newApiKey": "omni_live_xyz789..."
    }
  }
  ```

---

## 🤖 AI-Native & Self-Documenting REST Endpoints

OmniSocket features built-in content-negotiated documentation endpoints so LLMs, AI coding assistants, and developers can fetch the live event contract directly from any running instance.

* **GET `/llms.txt`**: Aggregated raw GitHub-Flavored Markdown for AI agents.
* **GET `/docs`**: Topic index JSON (or raw Markdown if requested with `Accept: text/markdown` or `?format=md`).
* **GET `/docs/overview`**: Handshake, authentication headers, error codes.
* **GET `/docs/rooms`**: Room isolation, joining, leaving, broadcasting.
* **GET `/docs/presence`**: Presence status tracking & heartbeat ping/pong.
* **GET `/docs/events`**: Custom event routing payload schemas.

---

## 🏗️ Architecture Overview

```text
               +----------------------------------+
               |  Client Applications (SDK/IO)   |
               +----------------------------------+
                                |
                   Handshake Auth & API Key
                                v
               +----------------------------------+
               |      Fastify / Socket.IO         |
               |   Handshake & Docs Middleware    |
               +----------------------------------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
  +--------------------+                 +--------------------+
  | Security Sanitizer |                 | Dual-Tier Rate     |
  | & XSS Stripper     |                 | Limiting Guard     |
  +--------------------+                 +--------------------+
             |                                     |
             +------------------+------------------+
                                v
               +----------------------------------+
               |    Multi-Tenant Router & Rooms   |
               |    (ourtime:room-101, etc.)      |
               +----------------------------------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
  +--------------------+                 +--------------------+
  | Connection & User  |                 | Master Admin UI &  |
  | Registry (State)   |                 | Presence Engine    |
  +--------------------+                 +--------------------+
```

---

## 🚀 Quickstart

### Prerequisites
* **Node.js**: `v20.x` or higher
* **npm**: `v10.x` or higher

### 1. Installation
```bash
git clone https://github.com/your-org/omni-socket.git
cd omni-socket
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=*
ADMIN_API_KEY=omni_dev_super_secret_key_12345
ADMIN_PANEL_PATH=/admin-route
TOKEN_SIGNING_SECRET=omni_jwt_super_secret_signing_key_12345
DATABASE_URL=postgresql://user:password@localhost:5432/omni_socket
```

### 3. Development Server
```bash
npm run dev
```

### 4. Production Build & Start
```bash
npm run build
npm start
```

---

## 🧪 Testing & Load Stress Simulation

### Automated BDD Unit & Integration Testing (Vitest)
```bash
npm test
```

### 100-Client Load & Stress Simulation
```bash
npx tsx scripts/test-load-simulation.ts
```

---

## 🐳 Docker Deployment

### Run with Docker Compose
```bash
docker-compose up -d --build
```

### Manual Docker Build & Run
```bash
docker build -t omni-socket:latest .
docker run -d -p 4000:4000 --name omni-socket omni-socket:latest
```

---

## 📖 API & Event Specifications

For full WebSocket event payload contracts, client SDK usage, and REST health probe details, see [docs/api-spec.md](docs/api-spec.md) and [ROADMAP.md](ROADMAP.md).
