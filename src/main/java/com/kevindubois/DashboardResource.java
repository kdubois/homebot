package com.kevindubois;

import io.quarkus.oidc.client.OidcClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Backend for the dashboard UI: a pollable snapshot of MCP activity
 * (tool calls executed by the AI chat, resource updates from the MCP client)
 * and an endpoint that exchanges the configured OIDC credentials for an admin
 * bearer token the browser can use against the netatmo admin MCP server.
 */
@ApplicationScoped
@Path("/dashboard")
public class DashboardResource {

    @Inject
    McpActivityStream activityStream;

    @Inject
    TokenProvider tokenProvider;

    @GET
    @Path("/activity")
    @Produces(MediaType.APPLICATION_JSON)
    public List<String> activity() {
        return activityStream.snapshot();
    }

    @GET
    @Path("/admin-token")
    @Produces(MediaType.TEXT_PLAIN)
    public CompletableFuture<String> adminToken() {
        return tokenProvider.get();
    }
}

@ApplicationScoped
class TokenProvider {
    @Inject
    OidcClient oidcClient;

    CompletableFuture<String> get() {
        // Fetch on a pooled thread so the blocking OIDC token request never
        // runs on the Vert.x event loop.
        return CompletableFuture.supplyAsync(() ->
            oidcClient.getTokens().await().indefinitely().getAccessToken());
    }
}
