# HomeBot - Agent Guide

## Overview

Quarkus LangChain4j chatbot that connects to the Netatmo MCP server as an MCP client. Port 8080.

## Commands

```bash
./mvnw quarkus:dev    # Dev mode (requires netatmo app running on 8091)
./mvnw compile        # Compile check
```

## Architecture

| File | Purpose |
|------|---------|
| `ChatBotService.java` | AI Service interface: `@McpToolBox({"netatmo","netatmo-admin"})`, system message, `@HandleToolExecutionError` |
| `ChatBotWebSocket.java` | WebSocket endpoint (`/chatbot`), streams LLM responses, error recovery via `.onFailure().recoverWithItem()` |
| `AdminMcpAuthProvider.java` | `McpClientAuthProvider` for admin MCP client, uses OIDC client to get bearer token from Keycloak |
| `WeatherResource.java` | SSE endpoint for weather info |

## MCP Client Config

- `netatmo` → `http://localhost:8091/mcp` (public, no auth)
- `netatmo-admin` → `http://localhost:8091/admin/mcp` (OIDC auth via `AdminMcpAuthProvider`, health-check disabled)

## Auth

Default OIDC client configured with password grant (`alice/alice`). Auth-server-url auto-discovered via Keycloak Dev Services (shared container from netatmo app).

## UI

- `index.html` — Main page with chat widget
- `components/chatbot-title.js` — Lit component with suggestion buttons (dispatches `chatbot-send` events)
- `components/chatbot-chat.js` — Lit component managing WebSocket + `chat-bot` widget integration
- `chat-bot` element from `wc-chatbot` (mvnpm) — floating chat widget with shadow DOM

## Error Handling

1. `@HandleToolExecutionError` → returns message to LLM for retry
2. `.onFailure().recoverWithItem()` → user-facing error in chat
3. System message instructs LLM to use conservative data parameters

## Notes

- `wc-chatbot` widget must be toggled open before messages appear (handled in `chatbot-chat.js`)
- Suggestion buttons use `window` custom events to bridge Lit shadow DOM boundary
- `log-responses=false` to avoid streaming chunk noise in logs
