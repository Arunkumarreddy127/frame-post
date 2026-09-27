package com.example.framepost.page;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("pages")
public record Page(
        @Id String id,
        @Indexed String userId,
        String name,
        String description,
        String bio,
        Instant createdAt,
        Instant updatedAt
) {
}
