# Architecture Decision Log (ADR) - OmniSocket Cloud Infrastructure

This document records the architectural debate, component trade-off analysis, and final conclusions for the cloud infrastructure deployment of **omni-socket**.

---

## Game Rules & Process
- **Mode**: Step-by-step Architectural Defense & Component Grilling.
- **Goal**: Evaluate every cloud tier (Ingress, Compute, Database, Caching, Observability, IaC) by comparing alternatives, performance, security, operational overhead, and cost.
- **Output**: Decisions documented here will form the final, optimized cloud deployment blueprint.

---

## Decision Records

### Q1: Role of Configuration Management (Ansible) & Specific Server Configurations
* **Question**: What is the exact role of Configuration Management (Ansible), and what specific configurations are applied to our servers?
* **Ansible's Role**: Terraform provisions the raw cloud hardware (VPC, EC2, Security Groups), while Ansible automates the software, security, OS kernel, and container configuration inside the EC2 server instance.
* **Specific Configurations Applied by Ansible**:
  1. **OS Hardening & User Setup**: Update system packages, configure OS firewall (`ufw`/`firewalld`), and create an unprivileged deployment user (`devops`).
  2. **Docker Runtime & Log Rotation**: Install Docker CE Engine & Docker Compose plugin; configure Docker daemon log limits (`max-size: 10m`, `max-file: 3`) to prevent disk exhaustion.
  3. **Linux Kernel & Network Tuning for WebSockets**:
     - Increase file descriptor limits (`nofile 65535`) to handle thousands of concurrent WebSocket connections (Linux treats every open TCP socket as a file descriptor; default OS limit of 1024 causes `EMFILE: too many open files` crash).
     - Tune `sysctl` parameters (`net.core.somaxconn = 4096` expands the TCP connection queue from default 128 to 4096, preventing connection drops during flash traffic spikes).

  4. **NGINX Proxy Configuration**: Deploy NGINX virtual host templates with `ip_hash;` sticky sessions and WebSocket upgrade headers (`Upgrade: websocket`).
  5. **Observability Stack Orchestration**: Provision directory structures and config files for Prometheus, Grafana, Loki, and Promtail.

### Q2: Load Balancer Selection — AWS ALB (Layer 7) vs. AWS NLB (Layer 4)
* **Question**: Why are we using AWS ALB? Wouldn't an AWS Network Load Balancer (NLB) be a better choice for WebSockets?
* **Comparison & Trade-off Analysis**:
  - **AWS NLB (Layer 4 - TCP/UDP)**:
    - *Pros*: Extreme ultra-low latency, handles millions of raw TCP connections/sec, static IP addresses.
    - *Cons*: Cannot inspect HTTP headers/cookies; supports only Source IP stickiness (which breaks for users behind corporate NATs/proxies); cannot do HTTP path-based routing or integrate with AWS WAF.
  - **AWS ALB (Layer 7 - HTTP/HTTPS/WebSocket)**:
    - *Pros*: Native HTTP Cookie Sticky Sessions (`AWSALB` cookie) essential for Socket.IO HTTP Long Polling fallback; Layer 7 Path-based routing (`/socket.io`, `/admin-route`, `/metrics`, `/health`); native AWS WAF security integration; managed ACM SSL/TLS termination.
    - *Cons*: Marginally higher latency per packet than raw TCP NLB (negligible for web/mobile applications).

### Q3: Compute & Container Orchestration — Docker Compose on EC2
* **Question**: Why do we need Docker Compose on EC2, and what exact services are defined in `docker-compose.yml`?
* **Why Docker Compose on EC2?**:
  - **Isolation & Security**: Encapsulates `omni-socket` in an unprivileged multi-stage container (`node:20-alpine`) rather than polluting host OS.
  - **Multi-Container Co-location**: Manages `omni-socket` along with co-located host daemons (Promtail log shipper, Node Exporter host telemetry) in a single declarative configuration.
  - **Restart Policy & Health Probes**: Enforces `restart: unless-stopped` and native HTTP health checks to automatically recover crashed containers.
* **Services Defined in App Instance `docker-compose.yml`**:
  1. `omni-socket`: Application container connected to AWS RDS PostgreSQL and AWS ElastiCache Redis.
  2. `promtail`: Lightweight log shipper reading Pino JSON logs and forwarding to central Loki.
  3. `node-exporter`: Host metrics exporter for Prometheus scraping.
  *(Note: Managed RDS PostgreSQL and ElastiCache Redis run as managed AWS services outside Docker Compose).*
  
### Q4: Host Telemetry & Log Shipping Daemons — Node Exporter & Promtail
* **Question**: What are the exact roles and uses of `node-exporter` and `promtail` on each EC2 compute instance?
* **Node Exporter (Prometheus Host Metrics)**:
  - *Role*: Exposes host Linux kernel system metrics from `/proc` and `/sys` filesystems on port 9100.
  - *Metrics Collected*: CPU utilization/wait, RAM memory availability/swap, Disk I/O & space utilization, Network bytes in/out and dropped packets.
  - *Value*: Complements Node.js application metrics (`/metrics`) by alerting if the host EC2 instance is experiencing hardware resource exhaustion.
* **Promtail (Loki Log Shipper Agent)**:
  - *Role*: Lightweight log shipping agent that tails container logs (`/var/log/docker/*.log`) and system logs.
  - *Function*: Parses structured Pino JSON logs, enriches them with metadata labels (`app=omni-socket`, `instance_id`), and streams them over HTTP to central Grafana Loki.
  - *Value*: Eliminates manual SSH `docker logs` commands by centralizing real-time log search and error filtering in Grafana UI via LogQL.
* **Agreed Conclusion**: Both daemons are lightweight co-located containers in `docker-compose.yml`. Node Exporter is chosen over an in-app Node.js system metrics library because:
    1. *Generic Tooling*: "Node" refers to infrastructure server node (written in Go), completely independent of Node.js. Exposes host metrics at `GET http://<EC2-IP>:9100/metrics`.
    2. *Host-Level Scope*: Mounts host `/proc` and `/sys` filesystems (`pid: "host"`) to read entire EC2 host CPU, RAM, Disk, and Network stats.
    3. *Security & Isolation*: Node.js app runs as an unprivileged user inside Docker without root access to host filesystems.
    4. *Resilience*: If Node.js event loop freezes or crashes, `node-exporter` continues reporting metrics, pinpointing the root cause of the crash.

### Q5: Observability Stack Selection — PLG Stack (Prometheus, Grafana, Loki, Promtail) vs. Alternatives
* **Question**: Why do we need all four tools (Prometheus, Grafana, Loki, Promtail)? Are there single all-in-one alternatives, and what are their pros and cons?
* **Role Breakdown of the 4 Tools**:
  1. *Prometheus*: Time-series database that pulls & stores numerical metrics (CPU %, RAM, active sockets).
  2. *Promtail*: Log shipping agent running on compute hosts that tails container Pino JSON logs and ships them to Loki.
  3. *Loki*: Lightweight log aggregation database that indexes log metadata labels (`app=omni-socket`).
  4. *Grafana*: Unified visualization UI dashboard querying Prometheus (PromQL) and Loki (LogQL) on a single screen.
* **Comparison with Alternatives**:
  - **Option 1: PLG Stack (Prometheus + Loki + Grafana + Promtail)** *(Our Choice)*
    - *Pros*: 100% open-source, zero license cost, lightweight (Loki indexes labels only, saving 80% RAM/disk vs Elasticsearch), single unified Grafana UI for metrics + logs.
    - *Cons*: Requires self-hosting and managing monitoring container infrastructure.
  - **Option 2: AWS Native (CloudWatch + CloudWatch Logs)**
    - *Pros*: Fully managed, zero server setup required.
    - *Cons*: Expensive per-GB log ingestion fees, vendor lock-in, lacks open-source Grafana/PromQL flexibility.
  - **Option 3: ELK Stack (Elasticsearch + Logstash + Kibana)**
    - *Pros*: Powerful full-text search engine.
    - *Cons*: Extreme RAM/CPU footprint (Elasticsearch requires 4GB+ RAM), high maintenance overhead.
  - **Option 4: Datadog / New Relic (SaaS)**
    - *Pros*: Single agent install, zero infra maintenance.
    - *Cons*: Extremely expensive commercial SaaS pricing, doesn't showcase self-hosted DevOps & IaC skills.
* **Agreed Conclusion**: The **PLG Stack** is selected. It provides production-grade, open-source telemetry and unified Grafana dashboards while proving deep hands-on DevOps capabilities on a resume.

### Q6: Database Layer Selection — AWS RDS PostgreSQL vs. AWS Aurora vs. Self-Hosted Container
* **Question**: Why select AWS RDS PostgreSQL (Managed)? Why not AWS Aurora PostgreSQL or a self-hosted PostgreSQL container on EC2?
* **Comparison & Trade-off Analysis**:
  - **Self-Hosted PostgreSQL Container on EC2**:
    - *Pros*: $0 additional AWS service cost.
    - *Cons*: High data loss risk during EC2 crashes/terminations; high operational burden (manual WAL archiving, backups, PITR, replication, patching); risk of Linux OOM Killer terminating Postgres when Node.js RAM spikes.
  - **AWS Aurora PostgreSQL (Serverless v2 / Cluster)**:
    - *Pros*: Auto-scaling storage, instant multi-AZ failover, sub-second read replicas.
    - *Cons*: Expensive ($40–$80/mo base minimum even at idle); excessive overkill for `omni-socket` scale.
  - **AWS RDS PostgreSQL (Standard Managed RDS)** *(Our Choice)*:
    - *Pros*: 100% AWS Free Tier eligible (`db.t4g.micro` / `db.t3.micro` = $0/mo); fully managed automated backups, Point-in-Time Recovery (PITR), security patching, and multi-AZ support; standard production choice for 90% of cloud workloads.
    - *Cons*: Manual scaling of storage/instance class compared to Aurora.
* **Agreed Conclusion**: **AWS RDS PostgreSQL (Managed)** is selected. It provides enterprise-grade managed database reliability and automated backups at $0 AWS Free Tier cost, while proving Terraform RDS module & DB subnet group provisioning skills.

### Q7: Pub/Sub & Caching Layer — AWS ElastiCache Redis vs. Self-Hosted Redis Container
* **Question**: Why select AWS ElastiCache Redis vs. a self-hosted Redis container on EC2?
* **Comparison & Trade-off Analysis**:
  - **Nature of Redis Workload in `omni-socket`**:
    - Redis is used as the `@socket.io/redis-adapter` **Pub/Sub message broker** for cross-instance event broadcasting.
    - Unlike PostgreSQL, Pub/Sub data is **ephemeral in-memory transient stream data** (zero persistent database state). If Redis restarts, Socket.IO automatically reconnects pub/sub channels in < 1 second with zero data corruption.
  - **Option A: Self-Hosted Redis Container (in Docker Compose)**:
    - *Pros*: Extremely lightweight (< 20MB RAM footprint); $0 extra AWS infrastructure cost; simple local Docker network access.
    - *Cons*: Single point of failure (if EC2 node dies, cross-node broadcasting pauses until container restarts); manual cluster configuration if scaling Redis nodes.
  - **Option B: AWS ElastiCache Redis (Managed Cluster)**:
    - *Pros*: Covered under AWS Free Tier (`cache.t4g.micro` = 750 free hrs/mo); managed multi-AZ cluster failover, in-flight encryption, and automated engine patching; production-grade standard.
    - *Cons*: Minor Terraform complexity defining ElastiCache replication group & subnet group.
* **Agreed Conclusion**: **AWS ElastiCache Redis (Managed)** selected for production cloud architecture (utilizing AWS Free Tier), with **Self-Hosted Redis Container** retained as the default fallback in `docker-compose.yml` for local dev/testing.

### Q8: IaC & CI/CD Pipeline Selection — Terraform & Dual CI/CD Strategy (GitHub Actions + Jenkinsfile)
* **Question**: Why select Terraform for IaC? And how do we handle CI/CD to showcase both GitHub Actions AND Jenkins skills for resume impact?
* **IaC Tool (Terraform)**:
  - Selected over AWS CloudFormation/CDK due to cloud-agnostic HCL syntax, state management (`terraform.tfstate`), and universal market demand across 90%+ of DevOps job listings.
* **CI/CD Strategy (Dual Pipeline Integration)**:
  - **Primary Production CI/CD (GitHub Actions)**: Managed cloud-native pipeline (`.github/workflows/deploy.yml`) performing automated Vitest unit testing, TypeScript checking, Trivy container security scanning, image push to GitHub Container Registry (GHCR), and Ansible deployment execution over SSH.
  - **Enterprise Pipeline Showcase (Declarative `Jenkinsfile`)**: Provide a production-grade declarative `Jenkinsfile` in the root repository. Demonstrates enterprise Jenkins pipeline scripting (Checkout, Test, Security Scan, Build, Ansible Deploy), validating both modern cloud-native CI/CD and traditional enterprise CI/CD experience for resume reviewers.
* **Agreed Conclusion**: **Terraform** selected for IaC. **GitHub Actions** handles live repository CI/CD deployment, paired with an embedded declarative **`Jenkinsfile`** to cover both GitHub Actions & Jenkins on resume and in technical interviews.














