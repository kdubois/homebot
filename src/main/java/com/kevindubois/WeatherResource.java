package com.kevindubois;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;

@ApplicationScoped
@Path("/weather")
public class WeatherResource {
    @Inject
   ChatBotService chatBotService;

    @GET
    @Path("/current")
    @Produces("text/plain")
    public String hello() {
        return chatBotService.chat("What is the weather like right now?");
    }
}
