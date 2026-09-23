package com.kevindubois;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * Bounded in-memory ring of MCP activity events (JSON strings), newest last.
 * The dashboard polls {@link #snapshot()} to render its activity panel. Kept
 * deliberately simple (no reactive push) so it needs no reactive sink.
 */
@ApplicationScoped
public class McpActivityStream {

    private static final int CAPACITY = 100;

    private final ConcurrentLinkedDeque<String> events = new ConcurrentLinkedDeque<>();

    public void publish(String json) {
        events.addLast(json);
        while (events.size() > CAPACITY) {
            events.pollFirst();
        }
    }

    public List<String> snapshot() {
        return Collections.unmodifiableList(new ArrayList<>(events));
    }
}
