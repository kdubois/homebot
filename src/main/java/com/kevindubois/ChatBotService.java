package com.kevindubois;

import dev.langchain4j.service.SystemMessage;
import io.quarkiverse.langchain4j.RegisterAiService;
import io.quarkiverse.langchain4j.mcp.runtime.McpToolBox;
import io.smallrye.mutiny.Multi;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
@RegisterAiService
public interface ChatBotService {
    @McpToolBox({"netatmo"})
    @SystemMessage("You are a weather station bot. You have access to an " +
           "MCP Server that retrieves information from a weather station " +
           "Make sure to ALWAYS use date formats like YYYY-MM-DD" +
           " to interact with the MCP server ")
    String chat(String userMessage);
}
