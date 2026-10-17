package com.example.framepost.image;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.PersistenceCreator;

import com.example.framepost.generation.MediaMetadata;

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
        String parentResultKey,
        Map<String, MediaMetadata> mediaMetadata
) {

    @PersistenceCreator
    public ImageGeneration {
        inputKeys = inputKeys == null ? List.of() : List.copyOf(inputKeys);
        results = results == null ? List.of() : List.copyOf(results);
        mediaMetadata = mediaMetadata == null ? Map.of() : Map.copyOf(mediaMetadata);
    }

    public ImageGeneration(
            String id, String userId, String pageId, String prompt, String model, String size, String quality,
            int imageCount, String outputFormat, String background, String moderation, String partialImages,
            List<String> inputKeys, List<ImageResult> results, ImageGenerationStatus status, String error,
            Instant createdAt, String parentGenerationId, String parentResultKey
    ) {
        this(id, userId, pageId, prompt, model, size, quality, imageCount, outputFormat, background, moderation,
                partialImages, inputKeys, results, status, error, createdAt, parentGenerationId, parentResultKey,
                Map.of());
    }

    public record ImageResult(String key) {
    }
}
