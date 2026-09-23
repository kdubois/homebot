# HomeBot

This is Java-based AI app that consumes a NetAtmo weather station MCP server that can be found at https://github.com/kdubois/netatmo-java-mcp

It exposes two MCP-client surfaces on one page:

- **Dashboard** (default tab): the browser itself is a stateless MCP client. It talks JSON-RPC +
  Streamable HTTP directly to the netatmo server and demos every protocol 2026-07-28 feature as a
  user-facing behavior: resource read with a TTL cache chip and live push, a `subscriptions/listen`
  live feed, MRTR (`input_required`) as a confirmation dialog, OIDC-gated admin tools,
  structured results rendered as tables, `completion/complete`, and a live JSON-RPC trace panel.
  "Run guided demo" walks through all of it in ~90 seconds.
- **AI Chat** (second tab): a Quarkus LangChain4j chatbot that connects to the same MCP server as
  a backend client and streams LLM responses over WebSocket. Long (over-30-day) historical
  requests are confirmed right in the chat: the bot asks, and on your confirm the **browser**
  runs the fetch (it is an MCP client too, and completes the MRTR round-trip). Admin tools are
  unlocked by a "Sign in as admin" control, mirroring the Dashboard.

## MCP client stack

- Dashboard: in-browser client in `components/mcp-client.js` (vanilla JS, no dependencies)
- AI chat: `quarkus-langchain4j` (standalone `io.quarkiverse.langchain4j:quarkus-langchain4j-bom`)
  → `langchain4j-mcp`
- Both speak MCP protocol 2026-07-28 (stateless): `server/discover` first, no `initialize`,
  no session header; every request carries `_meta` with protocol version, client info,
  capabilities
- MRTR: the langchain4j client version cannot answer form-mode `inputRequests`, so the *chat's
  backend client* never completes MRTR by itself. Instead the server returns a clean error to
  the chat client, the LLM emits a `[RANGE_CONFIRM]` marker with the dates, and the chat UI
  shows a confirm card. On confirm, the browser runs the tool via `mcp-client.js` and auto-accepts
  the confirm form — the same MRTR round-trip the dashboard uses. The dashboard additionally
  offers the accept/decline modal directly.
- OTel: `quarkus-opentelemetry` on the classpath; `traceparent` is injected into each request's
  `_meta` for end-to-end tracing

## Features

- Dashboard: current conditions (resource + TTL cache), 7-day chart, devices + completion,
  admin actions (compare periods, anomaly scan, diagnostics, refresh), live feed, AI-chat
  activity, wire trace, guided demo
- AI chat: streaming LLM responses over WebSocket; in-chat MRTR confirmation for over-30-day
  historical ranges (the browser runs the fetch and completes the round-trip); admin tools
  (diagnostics, refresh, compare periods, anomaly scan) unlocked by a per-chat "Sign in as
  admin" control
- MCP client connecting to public (`/mcp`) and admin (`/admin/mcp`) endpoints
- OIDC password grant for admin tool access (Keycloak, `alice/alice`)
- Streaming chat via WebSocket + Lit web components

## Running

```bash
./mvnw quarkus:dev    # Port 8080, Keycloak Dev Services auto-discovered
```

Access the UI at http://localhost:8080/

## Backend endpoints

- `GET /dashboard/activity` — recent MCP activity (tool calls made by the AI chat, resource
  updates), polled by the dashboard activity panel
- `GET /dashboard/admin-token` — exchanges the configured OIDC credentials for a bearer token
  the browser uses for admin MCP calls (Dashboard admin actions) and to authorize the chat's
  "Sign in as admin" control
- `WS /chatbot` — chat WebSocket. Text messages are LLM prompts; `ADMIN-SIGNIN`/`ADMIN-SIGNOUT`
  are control commands that lock/unlock the admin tools for that connection

## Configuration

Key settings in `application.properties`:

```properties
# LLM provider (OpenAI-compatible)
quarkus.langchain4j.openai.base-url=http://localhost:1234/v1
quarkus.langchain4j.openai.chat-model.model-name=ibm/granite-4-h-tiny

# MCP clients
quarkus.langchain4j.mcp.netatmo.url=http://localhost:8091/mcp
quarkus.langchain4j.mcp.netatmo-admin.url=http://localhost:8091/admin/mcp
```

The OIDC client for admin auth is auto-configured by Keycloak Dev Services (shared container from
netatmo app). Uses `alice/alice` (admin role) via password grant.

## Architecture

| Component | Role |
|-----------|------|
| `home-dashboard.js` | Dashboard Lit component (the browser MCP client UI) |
| `mcp-client.js` | Shared 2026-07-28 wire client (JSON-RPC, headers, SSE, MRTR loop, listen) |
| `DashboardResource` | `/dashboard/activity` + `/dashboard/admin-token` |
| `McpActivityStream` | Bounded in-memory activity ring (published by observers) |
| `ChatBotService` | AI Service with `@McpToolBox`, system prompt (range-limit + confirm-marker rules, `{adminContext}`), error handler |
| `ChatBotWebSocket` | `/chatbot` WebSocket endpoint: streams responses, handles `ADMIN-SIGNIN`/`ADMIN-SIGNOUT`, passes admin state to the LLM |
| `AdminMcpAuthProvider` | `McpClientAuthProvider` for the AI chat's admin MCP client |
| `ToolEventObserver` / `ResourceUpdatedObserver` | Log + republish MCP events to the dashboard |
| `chatbot-title.js` | Chat tab header: admin sign-in/sign-out control + suggestion buttons |
| `chatbot-chat.js` | Chat tab: WebSocket streaming, `[RANGE_CONFIRM]` detection, in-browser MRTR confirm card, admin sign-in flow |

## Packaging

```bash
./mvnw package
java -jar target/quarkus-app/quarkus-run.jar

# Native
./mvnw package -Dnative -Dquarkus.native.container-build=true

# Container
docker build -f src/main/docker/Dockerfile.jvm -t quarkus/homebot-jvm .
```
