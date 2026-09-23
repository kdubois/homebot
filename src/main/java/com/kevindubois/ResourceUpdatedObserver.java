package com.kevindubois;

import io.quarkiverse.langchain4j.mcp.runtime.McpResourceUpdatedEvent;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.LinkedHashMap;
import java.util.Map;

@ApplicationScoped
public class ResourceUpdatedObserver {

    private static final Logger LOG = Logger.getLogger("MCP-Resource");

    @Inject
    McpActivityStream activityStream;

    void onResourceUpdated(@Observes McpResourceUpdatedEvent event) {
        LOG.infof("MCP-Resource updated: %s, client=%s", event.uri(), event.mcpClientKey());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "resource-updated");
        payload.put("uri", event.uri());
        payload.put("client", event.mcpClientKey());
        payload.put("ts", System.currentTimeMillis());
        activityStream.publish(new JsonObject(payload).encode());
    }
}
