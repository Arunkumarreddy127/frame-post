package com.example.framepost.generation;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** One generation with its text inputs and its stored input and output files. */
public record GenerationResponse(
        String id,
        String pageId,
        ContentGeneration.Provider provider,
        ContentGeneration.MediaType mediaType,
        String workflowKey,
        Map<String, String> inputs,
        ContentGeneration.Status status,
        String error,
        Instant createdAt,
        String parentGenerationId,
        String parentResultKey,
        List<MediaItemResponse> inputFiles,
        List<MediaItemResponse> outputs
) {
}
