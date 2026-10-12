package com.example.framepost.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "framepost.image")
public record ImageProperties(
        List<String> allowedModels,
        long requestTimeoutSeconds
) {
}
