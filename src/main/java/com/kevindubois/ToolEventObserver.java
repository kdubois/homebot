package com.kevindubois;

import dev.langchain4j.observability.api.event.ToolExecutedEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import org.jboss.logging.Logger;

import java.util.Set;

@ApplicationScoped
public class ToolEventObserver {

    private static final Logger LOG = Logger.getLogger("MCP-Activity");
    private static final Set<String> ADMIN_TOOLS = Set.of("refresh_station_data", "get_station_diagnostics");

    void onToolExecuted(@Observes ToolExecutedEvent event) {
        String toolName = event.request().name();
        String args = event.request().arguments();
        boolean isAdmin = ADMIN_TOOLS.contains(toolName);
        String result = event.resultText();

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
    }
}
