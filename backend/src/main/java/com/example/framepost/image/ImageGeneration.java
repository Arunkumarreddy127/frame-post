package com.example.framepost.image;

import java.time.Instant;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.PersistenceCreator;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("image_generations")
@CompoundIndex(name = "user_scope_created", def = "{'userId': 1, 'pageId': 1, 'createdAt': -1}")
public record ImageGeneration(
        @Id String id,
        @Indexed String userId,
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
        Instant createdAt
) {

    @PersistenceCreator
    public ImageGeneration {
        inputKeys = inputKeys == null ? List.of() : List.copyOf(inputKeys);
        results = results == null ? List.of() : List.copyOf(results);
    }

    public record ImageResult(String key, String url) {
    }
}
