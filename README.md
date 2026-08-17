# 🚀 OmniSocket Realtime Engine

OmniSocket is a **production-ready, application-agnostic, multi-tenant WebSocket infrastructure engine** built on top of Node.js, Fastify, Socket.IO, and TypeScript.

It serves as a standalone real-time messaging gateway for multiple client applications (e.g. video conferencing tools, chat applications, live whiteboards) with enterprise-grade security, rate limiting, presence tracking, and observability.

---

## 🌟 Key Features

* **Multi-Tenant Isolation**: Tenant applications (`applicationId`) share a single engine with complete event and room-level state isolation.
* **Dual-Tier Rate Limiting**: Socket-level (30 requests/10s) and Application-level (1000 requests/10s) sliding-window rate limit protection.
* **Granular Feature Guarding**: Enable or disable features (`rooms`, `presence`, `events`) per tenant application on the fly.
* **Presence & Heartbeat Engine**: Room-scoped status updates (`online`, `away`, `busy`, `offline`) and automated ping/pong heartbeat tracking.
* **Security & Input Sanitization**: Built-in XSS script stripping, HTML neutralization, prototype pollution prevention, and 64KB payload bounds.
* **Structured Audit Observability**: JSON log format with correlation IDs, action timing, and request tracing.
* **Graceful Teardown**: Intercepts `SIGTERM` / `SIGINT`, notifies connected clients (`server:shutdown`), flushes packets, and closes cleanly.
* **Production Containerization**: Multi-stage Dockerfile (`node:20-alpine`) with unprivileged `node` user and native Node HTTP health check probes.

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
               |      Handshake Middleware        |
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
  | Connection & User  |                 | Presence &         |
  | Registry (State)   |                 | Heartbeat Engine   |
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

For full WebSocket event payload contracts and REST health probe details, see [docs/api-spec.md](docs/api-spec.md).

---
