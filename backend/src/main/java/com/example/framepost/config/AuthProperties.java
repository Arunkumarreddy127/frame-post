package com.example.framepost.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "framepost.auth")
public record AuthProperties(boolean cookieSecure, long sessionHours) {
}
