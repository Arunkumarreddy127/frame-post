package com.example.framepost.generation;

import java.time.Instant;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import com.example.framepost.image.ImageGeneration;
import com.example.framepost.image.ImageGenerationStatus;
import com.example.framepost.runninghub.RunningHubGeneration;
import com.example.framepost.runninghub.RunningHubGenerationStatus;

@Document("content_generations")
public record ContentGeneration(
        @Id String id, String userId, String pageId, int schemaVersion, Provider provider,
        MediaType generationType, String workflowKey, Map<String, String> inputs,
        List<String> inputIds, List<String> outputIds, ProviderMetadata providerMetadata,
        Status status, String error, Instant createdAt, String parentGenerationId, String parentResultKey
) {
    public enum Provider { OPENAI, RUNNINGHUB }
    public enum MediaType { IMAGE, VIDEO }
    public enum Status { PROCESSING, COMPLETED, FAILED }
    public record ProviderMetadata(String runningHubTaskId, String instanceType) {}

    public ContentGeneration {
        inputs = immutableMap(inputs);
        inputIds = inputIds == null ? List.of() : List.copyOf(inputIds);
        outputIds = outputIds == null ? List.of() : List.copyOf(outputIds);
    }

    private static Map<String, String> immutableMap(Map<String, String> source) {
        return source == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(source));
    }

    public static ContentGeneration fromImage(ImageGeneration source) {
        return fromImage(source, List.of(), List.of());
    }

    public static ContentGeneration fromImage(
            ImageGeneration source,
            List<String> inputIds,
            List<String> outputIds
    ) {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("prompt", source.prompt());
        values.put("model", source.model());
        values.put("size", source.size());
        values.put("quality", source.quality());
        values.put("count", String.valueOf(source.imageCount()));
        values.put("outputFormat", source.outputFormat());
        values.put("background", source.background());
        values.put("moderation", source.moderation());
        values.put("partialImages", source.partialImages());
        return new ContentGeneration(source.id(), source.userId(), source.pageId(), 2, Provider.OPENAI,
                MediaType.IMAGE, null, values, inputIds, outputIds, null, Status.valueOf(source.status().name()),
                source.error(), source.createdAt(), source.parentGenerationId(), source.parentResultKey());
    }

    public ImageGeneration toImage() {
        return toImage(List.of(), List.of());
    }

    public ImageGeneration toImage(List<ContentInput> inputFiles, List<ContentOutput> outputFiles) {
        requireProvider(Provider.OPENAI);
        List<ContentInput> orderedInputs = inputFiles.stream()
                .sorted(Comparator.comparingInt(ContentInput::position)).toList();
        List<ContentOutput> orderedOutputs = outputFiles.stream()
                .sorted(Comparator.comparingInt(ContentOutput::position)).toList();
        Map<String, MediaMetadata> metadata = new LinkedHashMap<>();
        orderedInputs.forEach(file -> putMetadata(metadata, file.key(), file.sizeBytes(), file.width(), file.height(), file.durationSeconds()));
        orderedOutputs.forEach(file -> putMetadata(metadata, file.key(), file.sizeBytes(), file.width(), file.height(), file.durationSeconds()));
        return new ImageGeneration(id, userId, pageId, inputs.get("prompt"), inputs.get("model"),
                inputs.get("size"), inputs.get("quality"), Integer.parseInt(inputs.get("count")),
                inputs.get("outputFormat"), inputs.get("background"), inputs.get("moderation"),
                inputs.get("partialImages"), orderedInputs.stream().map(ContentInput::key).toList(),
                orderedOutputs.stream().map(file -> new ImageGeneration.ImageResult(file.key())).toList(),
                ImageGenerationStatus.valueOf(status.name()), error, createdAt, parentGenerationId, parentResultKey,
                metadata);
    }

    public static ContentGeneration fromRunningHub(RunningHubGeneration source, String outputType) {
        return fromRunningHub(source, outputType, List.of(), List.of());
    }

    public static ContentGeneration fromRunningHub(
            RunningHubGeneration source,
            String outputType,
            List<String> inputIds,
            List<String> outputIds
    ) {
        MediaType type = MediaType.valueOf(outputType.toUpperCase(java.util.Locale.ROOT));
        return new ContentGeneration(source.id(), source.userId(), source.pageId(), 2, Provider.RUNNINGHUB,
                type, source.workflowKey(), source.inputs(), inputIds, outputIds,
                new ProviderMetadata(source.runningHubTaskId(), source.instanceType()),
                Status.valueOf(source.status().name()), source.error(), source.createdAt(), null, null);
    }

    public RunningHubGeneration toRunningHub() {
        return toRunningHub(List.of(), List.of());
    }

    public RunningHubGeneration toRunningHub(List<ContentInput> inputFiles, List<ContentOutput> outputFiles) {
        requireProvider(Provider.RUNNINGHUB);
        Map<String, String> inputFileKeys = new LinkedHashMap<>();
        Map<String, MediaMetadata> metadata = new LinkedHashMap<>();
        inputFiles.stream().sorted(Comparator.comparingInt(ContentInput::position)).forEach(file -> {
            inputFileKeys.put(file.slot(), file.key());
            putMetadata(metadata, file.key(), file.sizeBytes(), file.width(), file.height(), file.durationSeconds());
        });
        ContentOutput result = outputFiles.stream()
                .min(Comparator.comparingInt(ContentOutput::position)).orElse(null);
        if (result != null) {
            putMetadata(metadata, result.key(), result.sizeBytes(), result.width(), result.height(), result.durationSeconds());
        }
        return new RunningHubGeneration(id, userId, pageId, workflowKey, inputs, inputFileKeys,
                result == null ? null : result.key(), result == null ? null : result.type(),
                result == null ? null : result.contentType(),
                providerMetadata == null ? null : providerMetadata.runningHubTaskId(),
                RunningHubGenerationStatus.valueOf(status.name()), error,
                providerMetadata == null ? null : providerMetadata.instanceType(), createdAt, metadata);
    }

    private static void putMetadata(
            Map<String, MediaMetadata> target, String key, Long sizeBytes, Integer width, Integer height,
            Long durationSeconds
    ) {
        if (sizeBytes != null || width != null || height != null || durationSeconds != null) {
            target.put(key, new MediaMetadata(sizeBytes, width, height, durationSeconds));
        }
    }

    private void requireProvider(Provider expected) {
        if (provider != expected) throw new IllegalStateException("Unexpected generation provider: " + provider);
    }
}