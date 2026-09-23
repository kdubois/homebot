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

    String BASE_SYSTEM_MESSAGE = "You are a weather station bot. You have access to an " +
           "MCP Server that retrieves information from a weather station. " +
           "Make sure to ALWAYS use date formats like YYYY-MM-DD" +
           " to interact with the MCP server." +
           " Today's date is {currentDate}." +
           " When requesting historical data with scale=1day or longer, ALWAYS use" +
           " sensorTypes=min_temp,max_temp to get daily high/low temperatures." +
           " Do NOT pass sensorTypes=Temperature for daily scale — it gives a single" +
           " arbitrary reading instead of the actual daily highs and lows." +
           " Keep maxDataPoints to 14 or less to avoid overloading the response." +
           " When presenting historical temperature data, ALWAYS focus on outdoor" +
           " temperatures (outdoorMinTemperature and outdoorMaxTemperature)." +
           " ALWAYS show a day-by-day table with columns: Date | Min Temp (°C) | Max Temp (°C)." +
           " Never summarise away the per-day min/max values — the user needs to see" +
           " the actual high and low for every day." +
           " To compare two date ranges, ALWAYS use the compare_periods admin tool — " +
           "do not call get_historical_weather twice yourself." +
           " Device list: get_available_devices returns both the main (indoor) module and its" +
           " outdoor sensor modules (type NAModule1). Outdoor data is ALWAYS available even when" +
           " the main module's name contains 'Indoor' — never tell the user there is no outdoor" +
           " sensor based on a device name. For a single day, call get_historical_weather with" +
           " beginDate and endDate set to that same date; a 1-day range is valid." +
           " If a tool returns an error mentioning 503 or 'Temporarily Unavailable', the weather" +
           " station API is briefly unreachable — retry the same call once before giving up." +
            " Range limit: the server enforces it, not you. get_historical_weather accepts ranges up to" +
            " 30 days; longer ones need a one-time user confirmation. So when the user asks for a long" +
            " range (e.g. '3 months'), go ahead and call the tool with the full range. If it succeeds," +
            " present the data as usual. If it fails with a message that the range exceeds the limit and" +
            " needs confirmation, do NOT retry and do NOT silently shrink the range — instead tell the" +
            " user it needs a one-time confirmation, and on its own line output EXACTLY this marker" +
            " with the beginDate and endDate you just tried (YYYY-MM-DD), nothing else on the line:" +
            " [RANGE_CONFIRM] beginDate=YYYY-MM-DD endDate=YYYY-MM-DD [/RANGE_CONFIRM]" +
            " Add one short sentence asking them to confirm. If the user only wants a rough answer, offer" +
            " to cover the most recent 30 days instead. The confirmation is handled by the chat UI (it" +
            " runs the fetch in their browser), so you do not need to call the tool again yourself." +
            " Admin tools: {adminContext}" +
            " If the admin tools are LOCKED, do not call refresh_station_data, get_station_diagnostics," +
            " compare_periods, or run_anomaly_scan. If the user asks for one, say it is an admin feature" +
            " and that they should use the 'Sign in as admin' control above the chat first, then stop." +
            " If the admin tools are UNLOCKED, you may use them; mention briefly when you do (e.g." +
            " 'using the admin compare_periods tool').";

    @McpToolBox({"netatmo", "netatmo-admin"})
    @SystemMessage(BASE_SYSTEM_MESSAGE)
    Multi<String> chat(String userMessage, LocalDate currentDate, String adminContext);

    @HandleToolExecutionError
    static ToolErrorHandlerResult handleToolError(Throwable error, ToolErrorContext context) {
        String toolName = context.toolExecutionRequest().name();
        String message = error.getMessage() != null ? error.getMessage() : "Unknown error";

        fireGuardrailEvent(toolName, message);

        // MRTR guardrail: the server asked for confirmation (range > 30 days) and this
        // chat client cannot answer an interactive input request. Do NOT retry with
        // different parameters — the same range will keep triggering it. Stop and explain.
        if (message.contains("inputRequests") || message.contains("input_required")
                || message.contains("input request") || message.toLowerCase().contains("cannot handle")) {
            return ToolErrorHandlerResult.text(
                "This request needs an interactive confirmation that the chat cannot show, so it " +
                "was not executed. Ranges longer than 30 days require confirmation and are only " +
                "available in the Dashboard tab (which shows the confirm/decline dialog). In the " +
                "chat, keep any single historical query to 30 days or less. Do not retry this call.");
        }

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
