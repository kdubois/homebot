package com.kevindubois;

import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.OnTextMessage;
import io.quarkus.websockets.next.WebSocket;
import io.smallrye.mutiny.Multi;
import java.time.LocalDate;

@WebSocket(path = "/chatbot")
public class ChatBotWebSocket {

    private final ChatBotService chatBotService;

    public ChatBotWebSocket(ChatBotService chatBotService) {
        this.chatBotService = chatBotService;
    }

    @OnOpen
    public void onOpen() {
    }

    @OnTextMessage
    public Multi<String> onTextMessage(String message) {
        return chatBotService.chat(message, LocalDate.now())
            .onFailure().recoverWithItem(error ->
                "Sorry, I encountered an error processing your request: " +
                (error.getMessage() != null ? error.getMessage() : "Unknown error") +
                ". Please try again with a simpler question or shorter date range.");
    }
}
