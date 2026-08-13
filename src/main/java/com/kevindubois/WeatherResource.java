package com.kevindubois;

import io.smallrye.mutiny.Multi;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.time.LocalDate;
import org.jboss.resteasy.reactive.RestStreamElementType;

@ApplicationScoped
@Path("/weather")
public class WeatherResource {
    @Inject
    ChatBotService chatBotService;

    @GET
    @Path("/current")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.TEXT_PLAIN)
    public Multi<String> hello() {
        return chatBotService.chat("What is the weather like right now?", LocalDate.now());
    }
}
