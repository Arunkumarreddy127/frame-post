package com.example.framepost.creation;

import java.time.Instant;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A camera setup inside a scene. Its invocations are the creation items that carry this shot's id.
 * {@code finalItemId} names the invocation chosen as the shot's output.
 */
@Document("creation_shots")
public record Shot(
        @Id String id,
        String creationId,
        String sceneId,
        int position,
        String title,
        String brief,
        String shotSize,
        List<String> shotTypes,
        String movement,
        Integer durationSeconds,
        String finalItemId,
        Instant createdAt,
        Instant updatedAt
) {
}
