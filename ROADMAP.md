# 🚀 OmniSocket Infrastructure Roadmap

This document outlines the current feature state and planned future enhancements for the **OmniSocket** multi-tenant realtime engine.

---

## 📌 Current Capabilities (v1.4.0 Release)

- [x] **Multi-Tenant Authentication**: Handshake validation with `applicationId`, `apiKey`, and `userId`.
- [x] **Room Isolation & WebRTC Signaling**: Dynamic room creation (`scopedRoomKey`) and broadcast routing.
- [x] **Dual-Tier Rate Limiting**: Per-socket and per-tenant burst protection.
- [x] **Presence & Heartbeat**: Realtime status updates (`presence:update`) and latency pings (`presence:ping`).
- [x] **Structured Event ACK Envelopes**: Standardized response wrapping for socket acknowledgments.
- [x] **Security Input Sanitizer**: XSS tag stripping, prototype pollution prevention, and nesting depth checks.
- [x] **Database Persistence**: PostgreSQL Drizzle ORM application repository layer.
- [x] **Tenant REST Management API**: Complete endpoints for creating, updating, listing, rotating keys, and deleting apps.
- [x] **Glassmorphic Master Admin Panel**:
  - Secure obfuscated access route (`ADMIN_PANEL_PATH`).
  - Master Admin Key authentication.
  - Complete application CRUD (Register, Edit, Rotate Key, Delete).
  - Subsystem readiness, active connection counters, and heap memory tracking.
  - Fully responsive on mobile, tablet, and desktop devices.
- [x] **Developer Client SDK**: Lightweight promise-based `OmniSocketClient` TypeScript SDK.
- [x] **Dockerization & Containerization**: Production-ready multi-stage `Dockerfile` and `docker-compose.yml`.
- [x] **Automated Test Suite**: 100% passing Vitest test suite with automated test application cleanup.

---

## 📋 Planned Future Tasks & Roadmap

### 1. 🔍 Master Admin Audit Log Explorer
- Add an **Audit Logs** tab to the Master Admin Panel.
- Display real-time security events, auth failures, and administrative operations.
- Provide search, severity filtering, and correlation ID tracing.

### 2. 📊 Real-Time Analytics & Usage Charts
- Add SVG/Canvas metrics charts to the Master Admin Panel.
- Display connection count trends, peak concurrent users (CCU), and message throughput over time.

### 3. 🌐 Horizontal Scaling via Redis Adapter
- Integrate `@socket.io/redis-adapter` and Redis Pub/Sub.
- Enable cross-node room broadcasting and seamless multi-instance horizontal scaling.

### 4. 🔐 Advanced RBAC & Scoped Tenant Permissions
- Introduce granular role-based permissions for tenant API keys (e.g. read-only, room-only, broadcast-only).
