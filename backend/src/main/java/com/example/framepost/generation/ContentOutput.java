package com.example.framepost.generation;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("content_outputs")
public record ContentOutput(
        @Id String id,
        String generationId,
        String userId,
        String pageId,
        String type,
        int position,
        String key,
        String url,
        String name,
        String contentType,
        String mediaType,
        Long sizeBytes,
        Integer width,
        Integer height,
        Long durationSeconds,
        Instant createdAt
) {
}
