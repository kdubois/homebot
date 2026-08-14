# HomeBot

Quarkus LangChain4j chatbot that uses MCP tools from the Netatmo weather station server. Streams LLM responses over WebSocket.

## Features

- MCP client connecting to public (`/mcp`) and admin (`/admin/mcp`) endpoints
- OIDC client credentials for authenticated admin tool access (Keycloak)
- Streaming chat via WebSocket + Lit web components
- Prompt suggestion buttons for common queries
- Graceful error handling (`@HandleToolExecutionError` + WebSocket recovery)

## Running

Requires the netatmo MCP server running on port 8091.

```bash
./mvnw quarkus:dev    # Port 8080, Keycloak Dev Services auto-discovered
```

Access the UI at http://localhost:8080/

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

The OIDC client for admin auth is auto-configured by Keycloak Dev Services (shared container from netatmo app). Uses `alice/alice` (admin role) via password grant.

## Architecture

| Component | Role |
|-----------|------|
| `ChatBotService` | AI Service with `@McpToolBox`, system prompt, error handler |
| `ChatBotWebSocket` | `/chatbot` WebSocket endpoint, streams responses |
| `AdminMcpAuthProvider` | `McpClientAuthProvider` for admin MCP client |
| `chatbot-title.js` | Suggestion buttons (Lit component) |
| `chatbot-chat.js` | WebSocket + chat widget bridge (Lit component) |

## Packaging

```bash
./mvnw package
java -jar target/quarkus-app/quarkus-run.jar

# Native
./mvnw package -Dnative -Dquarkus.native.container-build=true

# Container
docker build -f src/main/docker/Dockerfile.jvm -t quarkus/homebot-jvm .
```
