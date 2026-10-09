package com.example.framepost.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "framepost.openai")
public record OpenAiProperties(
        String apiKey,
        List<String> allowedModels,
        long requestTimeoutSeconds
) {
}
