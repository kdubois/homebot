package com.kevindubois;

import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.tool.ToolErrorContext;
import dev.langchain4j.service.tool.ToolErrorHandlerResult;
import io.quarkiverse.langchain4j.HandleToolExecutionError;
import io.quarkiverse.langchain4j.RegisterAiService;
import io.quarkiverse.langchain4j.mcp.runtime.McpToolBox;
import io.quarkus.arc.Arc;
import io.smallrye.mutiny.Multi;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import java.time.LocalDate;

@ApplicationScoped
@RegisterAiService
public interface ChatBotService {
    @McpToolBox({"netatmo", "netatmo-admin"})
    @SystemMessage("You are a weather station bot. You have access to an " +
           "MCP Server that retrieves information from a weather station. " +
           "Make sure to ALWAYS use date formats like YYYY-MM-DD" +
           " to interact with the MCP server." +
           " Today's date is {currentDate}." +
           " When requesting historical data with scale=1day or longer, ALWAYS use" +
           " sensorTypes=min_temp,max_temp to get daily high/low temperatures." +
           " Do NOT pass sensorTypes=Temperature for daily scale — it gives a single" +
           " arbitrary reading instead of the actual daily highs and lows." +
           " Keep maxDataPoints to 14 or less to avoid overloading the response.")
    Multi<String> chat(String userMessage, LocalDate currentDate);

    @HandleToolExecutionError
    static ToolErrorHandlerResult handleToolError(Throwable error, ToolErrorContext context) {
        String toolName = context.toolExecutionRequest().name();
        String message = error.getMessage() != null ? error.getMessage() : "Unknown error";

        fireGuardrailEvent(toolName, message);

        if (message.contains("context") || message.contains("token") || message.contains("too long")) {
            return ToolErrorHandlerResult.text(
                "The request produced too much data. Please try again with a shorter date range or fewer data points.");
        }

        return ToolErrorHandlerResult.text(
            "Tool '" + toolName + "' encountered an error: " + message +
            ". Please try with different parameters or a simpler request.");
    }

    private static void fireGuardrailEvent(String toolName, String errorMessage) {
        try {
            Event<ActivityEvent> event = Arc.container()
                .instance(new jakarta.enterprise.util.TypeLiteral<Event<ActivityEvent>>() {}).get();
            event.fire(new ActivityEvent("guardrail", toolName, errorMessage));
        } catch (Exception ignored) {
        }
    }
}
