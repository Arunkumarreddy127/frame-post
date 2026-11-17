package com.example.framepost.creation;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** A named group of generations. {@code pageId} is null for creations outside any page. */
@Document("creations")
public record Creation(
        @Id String id,
        String userId,
        String pageId,
        String name,
        String description,
        Instant createdAt,
        Instant updatedAt
) {
}
