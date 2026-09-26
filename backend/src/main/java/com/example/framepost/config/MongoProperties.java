package com.example.framepost.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "spring.data.mongodb")
public record MongoProperties(String uri, String database) {
}
