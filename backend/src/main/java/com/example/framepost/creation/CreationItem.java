package com.example.framepost.creation;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Membership of one generation in one creation. The unique index on ({@code creationId}, {@code generationId})
 * keeps a generation from being added twice to the same creation. {@code parentItemId} records which item a tool invocation continues.
 * {@code shotId} and {@code sceneId} are null for items that are not assigned to a shot yet.
 */
@Document("creation_items")
public record CreationItem(
        @Id String id,
        String creationId,
        String generationId,
        int position,
        String parentItemId,
        String sceneId,
        String shotId,
        String tool,
        Instant createdAt
) {
}
