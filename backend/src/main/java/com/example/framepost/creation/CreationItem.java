package com.example.framepost.creation;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Membership of one generation in one creation. The unique index on {@code generationId} keeps a
 * generation in at most one creation. {@code parentItemId} records which item a storyboard step continues.
 */
@Document("creation_items")
public record CreationItem(
        @Id String id,
        String creationId,
        String generationId,
        int position,
        String laneId,
        String parentItemId,
        Instant createdAt
) {
}
