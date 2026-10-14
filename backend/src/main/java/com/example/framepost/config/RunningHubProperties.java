package com.example.framepost.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "framepost.runninghub")
public record RunningHubProperties(
        String apiKey,
        String baseUrl,
        long requestTimeoutSeconds,
        long pollIntervalSeconds,
        long maxWaitSeconds,
        String webhookBaseUrl,
        String webhookSecret
) {
}
