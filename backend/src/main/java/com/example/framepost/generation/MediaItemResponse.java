package com.example.framepost.generation;

import java.time.Instant;

/** A stored input or output file. {@code slot} is set for inputs and {@code type} for outputs. */
public record MediaItemResponse(
        String id,
        String generationId,
        String pageId,
        String slot,
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
