package com.kevindubois;

import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.UserData;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import io.smallrye.mutiny.Multi;
import java.time.LocalDate;

@WebSocket(path = "/chatbot")
public class ChatBotWebSocket {

    private static final UserData.TypedKey<Boolean> ADMIN =
        new UserData.TypedKey<>("chatbot-admin");
    private static final String ADMIN_CMD = "ADMIN-SIGNIN";
    private static final String ADMIN_OUT_CMD = "ADMIN-SIGNOUT";

    private final ChatBotService chatBotService;

    public ChatBotWebSocket(ChatBotService chatBotService) {
        this.chatBotService = chatBotService;
    }

    @OnOpen
    public void onOpen() {
    }

    @OnTextMessage
    public Multi<String> onTextMessage(String message, WebSocketConnection connection) {
        // The admin sign-in arrives as a control command from the chat UI (mirrors the
        // Dashboard's "sign in to unlock admin"). It is handled here, not sent to the LLM,
        // because the admin tools already authenticate via the backend MCP auth provider;
        // signing in only controls whether the bot is allowed to use them.
        if (ADMIN_CMD.equals(message.trim())) {
            connection.userData().put(ADMIN, true);
            return Multi.createFrom().items(
                "Signed in as admin. The station admin tools (diagnostics, refresh, period " +
                "comparison, anomaly scan) are now unlocked in this chat.");
        }
        if (ADMIN_OUT_CMD.equals(message.trim())) {
            connection.userData().put(ADMIN, false);
            return Multi.createFrom().items(
                "Signed out of admin. The station admin tools are locked again in this chat.");
        }

        boolean admin = Boolean.TRUE.equals(connection.userData().get(ADMIN));
        String adminContext = admin
            ? "The station admin tools are UNLOCKED (the user signed in as admin)."
            : "The station admin tools are LOCKED (the user has not signed in as admin).";

        return chatBotService.chat(message, LocalDate.now(), adminContext)
            .onFailure().recoverWithItem(error ->
                "Sorry, I encountered an error processing your request: " +
                (error.getMessage() != null ? error.getMessage() : "Unknown error") +
                ". Please try again with a simpler question or shorter date range.");
    }
}
