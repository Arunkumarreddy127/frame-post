package com.example.framepost.generation;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("content_inputs")
public record ContentInput(
        @Id String id,
        String generationId,
        String userId,
        String pageId,
        String slot,
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
        Instant createdAt,
        Boolean referenced
) {

    /** True when the file was stored by another generation, i.e. the key is not under this generation's folder. */
    public static boolean isReference(String generationId, String key) {
        return !key.contains("/" + generationId + "/");
    }
}
