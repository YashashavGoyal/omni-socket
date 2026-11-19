export interface DocTopic {
  id: string;
  title: string;
  summary: string;
  markdownContent: string;
}

export class DocsService {
  private topics: Map<string, DocTopic> = new Map();

  constructor() {
    this.initializeDocs();
  }

  private initializeDocs(): void {
    // 1. Overview & Authentication
    this.topics.set('overview', {
      id: 'overview',
      title: 'Handshake & Authentication Protocol',
      summary: 'Connection setup, auth credentials, ephemeral client tokens, error codes.',
      markdownContent: `# OmniSocket Authentication & Handshake Guide

## Connecting to OmniSocket
OmniSocket supports dual-mode authentication during the initial Socket.IO handshake:
1. **Server Mode**: For backend microservices, workers, and bots using master credentials.
2. **Client Mode**: For frontend browsers and mobile apps using ephemeral connection tokens.

---

### 1. Ephemeral Client Connection Tokens (Frontend / Untrusted Clients)
To prevent exposing your master API key in client bundles or network tabs, your backend requests a short-lived token from OmniSocket:

#### Minting a Token (Backend-to-Server)
**POST** \`/api/v1/auth/tokens\`
\`\`\`http
// Headers (Strictly required for authentication):
x-application-id: ourtime
x-api-key: <TENANT_MASTER_API_KEY>
Content-Type: application/json

// Body (Token attributes):
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
\`\`\`

#### Client Handshake Payload
The client connects using the minted token. Under OmniSocket v2.0, \`type: "client"\` is strictly required and tenant master credentials must not be passed:
\`\`\`json
{
  "auth": {
    "type": "client",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
\`\`\`

---

### 2. Server Mode Handshake (Backend Microservices / Daemons)
Server microservices authenticate using their tenant master credentials. \`type: "server"\`, \`applicationId\`, \`apiKey\`, and \`userId\` are all strictly required:
\`\`\`json
{
  "auth": {
    "type": "server",
    "applicationId": "ourtime",
    "apiKey": "ourtime_secret_key_v1",
    "userId": "backend_worker"
  }
}
\`\`\`

---

### Authentication Error Responses
If authentication fails during the Socket.IO handshake, the server emits a \`connect_error\` event and closes the socket:
\`\`\`json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "<Error Message>"
}
\`\`\`

Standard error messages:
- **Missing or invalid type**: \`Missing or invalid connection type in handshake.auth (must be 'server' or 'client')\`
- **Malformed client handshake**: \`Client connection requires token and must not include apiKey or applicationId\`
- **Malformed server handshake**: \`Server connection requires applicationId, apiKey, and userId, and must not include token\`
- **Invalid or expired token**: \`Authentication failed: Invalid or expired client connection token\`
- **Invalid master credentials**: \`Authentication failed: Invalid application credentials\`
`,
    });

    // 2. Room Subsystem
    this.topics.set('rooms', {
      id: 'rooms',
      title: 'Multi-Tenant Room Isolation API',
      summary: 'Joining, leaving, and broadcasting to isolated rooms.',
      markdownContent: `# OmniSocket Room Event Contracts

## 1. Join Room (\`room:join\`)
Emit \`room:join\` to join a specific tenant-scoped room.

\`\`\`json
// Client Emit
socket.emit("room:join", { "roomId": "call-101" });

// Server Response ACK / Event "room:joined"
{
  "status": "success",
  "event": "room:joined",
  "roomId": "call-101",
  "scopedRoomKey": "ourtime:call-101"
}
\`\`\`

## 2. Leave Room (\`room:leave\`)
\`\`\`json
// Client Emit
socket.emit("room:leave", { "roomId": "call-101" });
\`\`\`

## 3. Broadcast to Room (\`room:broadcast\`)
Emits an event to all other clients in the specified room.

\`\`\`json
// Client Emit
socket.emit("room:broadcast", {
  "roomId": "call-101",
  "event": "signal:offer",
  "data": { "sdp": "v=0..." }
});
\`\`\`
`,
    });

    // 3. Presence Subsystem
    this.topics.set('presence', {
      id: 'presence',
      title: 'Presence & Heartbeat Engine API',
      summary: 'Status updates (online, away, busy) and heartbeat pings.',
      markdownContent: `# OmniSocket Presence & Heartbeat Guide

## 1. Update Status (\`presence:update\`)
Emit status updates to your current room.

\`\`\`json
// Client Emit
socket.emit("presence:update", {
  "roomId": "call-101",
  "status": "busy",
  "customStatusMessage": "In a call"
});

// Broadcast Event "presence:changed"
{
  "userId": "alice_123",
  "applicationId": "ourtime",
  "status": "busy",
  "customStatusMessage": "In a call",
  "activeSocketsCount": 1,
  "lastSeenAt": "2026-08-18T01:00:00.000Z"
}
\`\`\`

## 2. Heartbeat Ping (\`presence:ping\`)
Send pings every 30 seconds to maintain active presence.

\`\`\`json
// Client Emit
socket.emit("presence:ping");

// ACK Response
{
  "status": "success",
  "event": "presence:pong",
  "lastSeenAt": "2026-08-18T01:00:05.000Z"
}
\`\`\`
`,
    });

    // 4. Custom Events Subsystem
    this.topics.set('events', {
      id: 'events',
      title: 'Generic Event Router API',
      summary: 'Targeted event emitting across rooms or users.',
      markdownContent: `# OmniSocket Event Router Guide

## Emit Custom Event (\`event:emit\`)
Emit generic custom events across room or application spaces.

\`\`\`json
// Client Emit
socket.emit("event:emit", {
  "targetType": "room",
  "targetId": "call-101",
  "eventName": "chat:message",
  "data": { "text": "Hello team!" }
});
\`\`\`
`,
    });
  }

  public getTopic(topicId: string): DocTopic | undefined {
    return this.topics.get(topicId);
  }

  public getAllTopicIds(): string[] {
    return Array.from(this.topics.keys());
  }

  public getAllTopicSummaries(): { id: string; title: string; summary: string }[] {
    return Array.from(this.topics.values()).map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
    }));
  }

  public getFullAggregatedMarkdown(): string {
    let fullDoc = `# 🤖 OmniSocket Complete Client Integration & API Documentation\n\n`;
    fullDoc += `> **Note for AI Agents & Bots**: This document contains the full WebSocket event contract for OmniSocket real-time engine.\n\n`;

    for (const topic of this.topics.values()) {
      fullDoc += `---\n\n${topic.markdownContent}\n\n`;
    }

    return fullDoc;
  }
}

export const docsService = new DocsService();
