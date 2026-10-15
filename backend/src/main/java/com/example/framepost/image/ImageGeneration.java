package com.example.framepost.image;

import java.time.Instant;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.PersistenceCreator;

public record ImageGeneration(
        @Id String id,
    String userId,
        String pageId,
        String prompt,
        String model,
        String size,
        String quality,
        int imageCount,
        String outputFormat,
        String background,
        String moderation,
        String partialImages,
        List<String> inputKeys,
        List<ImageResult> results,
        ImageGenerationStatus status,
        String error,
        Instant createdAt,
        String parentGenerationId,
        String parentResultKey
) {

    @PersistenceCreator
    public ImageGeneration {
        inputKeys = inputKeys == null ? List.of() : List.copyOf(inputKeys);
        results = results == null ? List.of() : List.copyOf(results);
    }

    public record ImageResult(String key) {
    }
}
