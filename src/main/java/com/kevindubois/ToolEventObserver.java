package com.kevindubois;

import dev.langchain4j.observability.api.event.ToolExecutedEvent;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class ToolEventObserver {

    private static final Logger LOG = Logger.getLogger("MCP-Activity");
    private static final Set<String> ADMIN_TOOLS = Set.of(
            "refresh_station_data", "get_station_diagnostics", "compare_periods", "run_anomaly_scan");

    @Inject
    McpActivityStream activityStream;

    void onToolExecuted(@Observes ToolExecutedEvent event) {
        String toolName = event.request().name();
        String args = event.request().arguments();
        boolean isAdmin = ADMIN_TOOLS.contains(toolName);
        String result = event.resultText();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "tool");
        payload.put("tool", toolName);
        payload.put("admin", isAdmin);
        payload.put("args", args);
        payload.put("result", result);
        payload.put("ts", System.currentTimeMillis());
        activityStream.publish(new JsonObject(payload).encode());

        String prefix = isAdmin ? "🔒 ADMIN" : "🔧 TOOL ";
        LOG.infof("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        LOG.infof("%s  %s", prefix, toolName);

        if (args != null && !args.equals("{}")) {
            String shortArgs = args.length() > 120 ? args.substring(0, 120) + "..." : args;
            LOG.infof("   ↳ args: %s", shortArgs);
        }

        if (result != null) {
            if (result.contains("encountered an error") || result.contains("too much data")) {
                LOG.warnf("   ⚠ GUARDRAIL: %s", result.length() > 150 ? result.substring(0, 150) + "..." : result);
            } else {
                String shortResult = result.length() > 200 ? result.substring(0, 200) + "..." : result;
                LOG.infof("   ✓ result: %s", shortResult);
            }
        }
    }

    void onActivityEvent(@Observes ActivityEvent event) {
        LOG.warnf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        LOG.warnf("⚠ GUARDRAIL  %s → %s", event.tool(), event.message());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "guardrail");
        payload.put("tool", event.tool());
        payload.put("message", event.message());
        payload.put("ts", System.currentTimeMillis());
        activityStream.publish(new JsonObject(payload).encode());
    }
}
