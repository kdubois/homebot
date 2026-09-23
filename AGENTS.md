# HomeBot - Agent Guide

## Overview

Home weather app, port 8080, with two MCP-client surfaces:
- **Dashboard** (default tab): a Lit UI where the *browser itself* is a stateless MCP client
  (JSON-RPC + Streamable HTTP straight to netatmo), demoing every 2026-07-28 feature.
- **AI Chat** (second tab): a Quarkus LangChain4j chatbot that connects to the Netatmo MCP
  server as a backend MCP client.

## MCP client stack

- `io.quarkiverse.langchain4j:quarkus-langchain4j-bom` 1.14.0.CR3 (standalone BOM imported in
  `dependencyManagement`; replaces the platform-sourced `quarkus-langchain4j-bom`).
  `io.quarkus.platform:quarkus-bom` 3.39.4 is kept for the rest of the stack.
- Resolves `quarkus-langchain4j-mcp` 1.14.0.CR3 → `dev.langchain4j:langchain4j-mcp` 1.20.0-beta30.
- Speaks MCP protocol **2026-07-28 (stateless)**: the first call to the server is `server/discover`
  (no `initialize`, no `Mcp-Session-Id` header; every request carries `_meta` with
  `protocolVersion`, `clientInfo`, `clientCapabilities`). The client also sends
  `subscriptions/listen` on connect (tools/prompts/resources list changes) and puts an OTel
  `traceparent` into each request's `_meta` when tracing is active.
- OTel: `quarkus-opentelemetry` is on the classpath; the OTel dev service exports spans, so a chat
  turn shows one trace across the OpenAI call, the MCP client request, and (with server-side tracing
  enabled) the netatmo handling.

## MRTR in the AI chat (in-browser confirmation)

`langchain4j-mcp` 1.20.0-beta30 cannot answer form-mode `inputRequests`, so the chat's backend
client can never complete an MRTR on its own. The netatmo server branches on
`elicitation.isFormModeSupported()` in `checkLargeRange`:

- **Elicitation-capable client** (the dashboard's browser): the server throws the
  `InputRequiredException` with the `confirm_range` form; `components/mcp-client.js` renders it
  as a modal and retries with `inputResponses` + `requestState`.
- **Client without elicitation** (the chat's backend client, which declares
  `clientCapabilities: {}`): the server returns a clean, actionable `ToolCallException`
  (range over 30 days, do not retry, output the confirmation marker). The LLM then emits one
  marker line: `[RANGE_CONFIRM] beginDate=YYYY-MM-DD endDate=YYYY-MM-DD [/RANGE_CONFIRM]`.

`chatbot-chat.js` accumulates each streamed turn, detects the marker (tolerant regex over the
whole turn), strips it from the message and shows a Confirm/Cancel card. On confirm, the
**browser** — which is elicitation-capable — re-runs `get_historical_weather` via
`mcp-client.js`. The server answers `input_required` again, and the chat auto-accepts the
single-boolean confirm form (`content: {confirm: true}`); the click is the confirmation. The
converged result is sent back to the LLM as a user message, which summarizes it. No
`@HandleToolExecutionError` involvement: the MCP client returns `isError` tool results to the
LLM rather than throwing.

## Commands

```bash
./mvnw quarkus:dev    # Dev mode (requires netatmo app running on 8091)
./mvnw compile        # Compile check
```

## Architecture

| File | Purpose |
|------|---------|
| `ChatBotService.java` | AI Service interface: `@McpToolBox({"netatmo","netatmo-admin"})`, system message (range-limit rules + `[RANGE_CONFIRM]` marker contract + `{adminContext}` placeholder), `@HandleToolExecutionError` (503 retry / context guardrails). Method signature: `chat(String userMessage, LocalDate currentDate, String adminContext)` — the extra String param becomes a system-message template variable. |
| `ChatBotWebSocket.java` | WebSocket endpoint (`/chatbot`). `@OnTextMessage(String, WebSocketConnection)`: handles `ADMIN-SIGNIN`/`ADMIN-SIGNOUT` control messages (stored in the connection's `UserData`), builds the `adminContext` string for the LLM, streams responses, error recovery via `.onFailure().recoverWithItem()`. |
| `AdminMcpAuthProvider.java` | `McpClientAuthProvider` for admin MCP client, uses OIDC client to get bearer token from Keycloak |
| `WeatherResource.java` | SSE endpoint for weather info |
| `ToolEventObserver.java` | Logs `ToolExecutedEvent` (MCP-Activity logger) and republishes it to the dashboard activity panel; `ADMIN_TOOLS` = `refresh_station_data`, `get_station_diagnostics`, `compare_periods`, `run_anomaly_scan` |
| `ResourceUpdatedObserver.java` | Logs `McpResourceUpdatedEvent` (MCP-Resource logger) and republishes it. With the 1.20.0-beta30 client, list-change subscriptions are enabled automatically in stateless mode: on connect the client issues `subscriptions/listen` with `toolsListChanged`/`promptsListChanged`/`resourcesListChanged` (plus any `resourceSubscriptions`), and `resources/updated` notifications for subscribed URIs fire `McpResourceUpdatedEvent` |
| `McpActivityStream.java` | Bounded (100) in-memory ring of JSON activity events, published by the observers above |
| `DashboardResource.java` | `GET /dashboard/activity` (pollable activity snapshot) and `GET /dashboard/admin-token` (OIDC password grant → bearer token for the browser's admin MCP calls) |

## MCP Client Config

- `netatmo` → `http://localhost:8091/mcp` (public, no auth)
- `netatmo-admin` → `http://localhost:8091/admin/mcp` (OIDC auth via `AdminMcpAuthProvider`, health-check disabled)

## Auth

Default OIDC client configured with password grant (`alice/alice`). Auth-server-url auto-discovered via Keycloak Dev Services (shared container from netatmo app).

## UI

Tabbed page (`index.html`): **Dashboard** (default) and **AI Chat**.

- `components/home-dashboard.js` — Lit dashboard. The browser is a first-class stateless MCP
  client: current-conditions card (resource + TTL cache chip with live countdown + push pulse),
  7-day chart (`get_historical_weather`), device cards + `completion/complete`, admin actions
  (`compare_periods`/`run_anomaly_scan`/`get_station_diagnostics`/`refresh_station_data`) gated
  behind `/dashboard/admin-token`, the MRTR modal for `get_historical_weather` >30-day ranges,
  a live `subscriptions/listen` feed, an AI-chat activity panel (polls `/dashboard/activity`),
  a live JSON-RPC trace panel, and a "Run guided demo" mode that walks through every feature.
- `components/mcp-client.js` — Shared 2026-07-28 wire client (stateless `_meta`, `Mcp-Method`/
  `Mcp-Name`/`Mcp-Param-*` headers, SSE frame parsing, `callTool` with MRTR accept/decline
  loop, `openListen`). Adapted from netatmo's `explorer.html`. Talks cross-origin to
  `http://localhost:8091/mcp` and `/admin/mcp` (CORS configured on the server).
- `components/chatbot-title.js` — Lit component: admin sign-in/sign-out control (top-right,
  state synced via `chatbot-admin-signed`/`chatbot-admin-signout` window events), suggestion
  buttons (dispatches `chatbot-send` events) including "3-Month History" (the in-chat MRTR demo).
- `components/chatbot-chat.js` — Lit component managing the WebSocket chat: turn accumulation
  (`_onMessage`, `_startTurn`), `[RANGE_CONFIRM]` marker detection (`_parseConfirm`), the
  confirm/decline card (`_confirmRange` runs the MRTR fetch in the browser with an auto-accept
  `onMrtr` handler, `_cancelConfirm`), and the admin sign-in flow (`_adminSignIn` calls
  `/dashboard/admin-token`, then sends `ADMIN-SIGNIN` over the socket).

## Error Handling

1. `@HandleToolExecutionError` → returns a message to the LLM (503 retry hint, "too much data").
   Note: it only fires on exceptions; MCP `isError` tool results are returned to the LLM as
   normal tool results (the langchain4j MCP client does not throw on them), so range-limit
   handling lives in the system message + the `[RANGE_CONFIRM]` flow, not here.
2. `.onFailure().recoverWithItem()` → user-facing error in chat
3. System message instructs the LLM to use conservative data parameters and to emit the
   `[RANGE_CONFIRM]` marker instead of retrying a range that exceeds the 30-day limit

## Notes

- Dashboard is the recommended demo surface; the explorer.html on netatmo is the raw protocol tester
- Dashboard admin calls go from the browser directly to `http://localhost:8091/admin/mcp` with the
  token from `/dashboard/admin-token` (Keycloak password grant, `alice/alice`)
- Netatmo upstream is flaky (transient 503s); the dashboard shows the tool error and a retry works
- "Compare Last 2 Weeks" in the AI Chat tab sends a `chatbot-send` message that instructs the LLM
  to use the `compare_periods` admin tool; the system message pins this tool for range comparisons
- Chat admin model: a single chat, not a separate admin chat. The backend admin MCP client
  (`AdminMcpAuthProvider`) authenticates automatically, so admin tools *can* always run; the
  in-chat "Sign in as admin" only flips a per-connection flag that the system message shows the
  LLM (`adminContext`), and the bot refuses admin tools while it is LOCKED. Mirrors the
  Dashboard's sign-in-to-unlock-admin UX. Sign-in is per WebSocket connection (`UserData`), so
  it resets when the page reloads.
- `log-responses=false` to avoid streaming chunk noise in logs
