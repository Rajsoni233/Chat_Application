package com.audio.ToText.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class Websocket implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // allow localhost in dev and your production railway host
        registry.addEndpoint("/ws-chat")
                .setAllowedOrigins(
                    "http://localhost:8080",
                    "https://talksy-production-5c5c.up.railway.app",  // add your railway domain
                    "https://talksy.railway.app" // optional if you have other domains
                )
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }
}
