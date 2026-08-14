package com.kevindubois;

import io.quarkiverse.langchain4j.mcp.auth.McpClientAuthProvider;
import io.quarkiverse.langchain4j.mcp.runtime.McpClientName;
import io.quarkus.oidc.client.OidcClient;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
@McpClientName("netatmo-admin")
public class AdminMcpAuthProvider implements McpClientAuthProvider {

    @Inject
    OidcClient oidcClient;

    @Override
    public String getAuthorization(Input input) {
        return "Bearer " + oidcClient.getTokens().await().indefinitely().getAccessToken();
    }
}
