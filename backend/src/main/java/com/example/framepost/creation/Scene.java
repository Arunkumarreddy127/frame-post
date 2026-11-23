package com.example.framepost.creation;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** A numbered section of a creation. Its number is its position, so it is never stored separately. */
@Document("creation_scenes")
public record Scene(
        @Id String id,
        String creationId,
        String userId,
        int position,
        String title,
        String description,
        Instant createdAt,
        Instant updatedAt
) {
}
