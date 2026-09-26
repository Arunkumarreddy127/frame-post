package com.example.framepost.auth;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("user_sessions")
public record UserSession(
        @Id String id,
        @Indexed String tokenHash,
        String userId,
        Instant expiresAt
) {
}
