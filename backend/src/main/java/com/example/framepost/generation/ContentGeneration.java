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
        Map<String, String> inputFileKeys, List<Output> outputs, ProviderMetadata providerMetadata,
        Status status, String error, Instant createdAt, String parentGenerationId, String parentResultKey
) {
    public enum Provider { OPENAI, RUNNINGHUB }
    public enum MediaType { IMAGE, VIDEO }
    public enum Status { PROCESSING, COMPLETED, FAILED }
    public record Output(String key, String type, String contentType) {}
    public record ProviderMetadata(String runningHubTaskId, String instanceType) {}

    public ContentGeneration {
        inputs = immutableMap(inputs);
        inputFileKeys = immutableMap(inputFileKeys);
        outputs = outputs == null ? List.of() : List.copyOf(outputs);
    }

    private static Map<String, String> immutableMap(Map<String, String> source) {
        return source == null ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(source));
    }

    public static ContentGeneration fromImage(ImageGeneration source) {
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
        Map<String, String> files = new LinkedHashMap<>();
        for (int index = 0; index < source.inputKeys().size(); index++) {
            files.put("attachment-" + (index + 1), source.inputKeys().get(index));
        }
        List<Output> outputs = source.results().stream()
                .map(result -> new Output(result.key(), "image", imageContentType(result.key(), source.outputFormat())))
                .toList();
        return new ContentGeneration(source.id(), source.userId(), source.pageId(), 1, Provider.OPENAI,
                MediaType.IMAGE, null, values, files, outputs, null, Status.valueOf(source.status().name()),
                source.error(), source.createdAt(), source.parentGenerationId(), source.parentResultKey());
    }

    private static String imageContentType(String key, String format) {
        String extension = key != null && key.contains(".") ? key.substring(key.lastIndexOf('.') + 1) : format;
        if (extension == null) return "application/octet-stream";
        return switch (extension.toLowerCase(java.util.Locale.ROOT)) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "png", "webp", "gif" -> "image/" + extension.toLowerCase(java.util.Locale.ROOT);
            default -> "application/octet-stream";
        };
    }

    public ImageGeneration toImage() {
        requireProvider(Provider.OPENAI);
        List<String> keys = inputFileKeys.entrySet().stream()
                .sorted(Comparator.comparingInt(entry -> Integer.parseInt(entry.getKey().substring("attachment-".length()))))
                .map(Map.Entry::getValue).toList();
        return new ImageGeneration(id, userId, pageId, inputs.get("prompt"), inputs.get("model"),
                inputs.get("size"), inputs.get("quality"), Integer.parseInt(inputs.get("count")),
                inputs.get("outputFormat"), inputs.get("background"), inputs.get("moderation"),
                inputs.get("partialImages"), keys,
                outputs.stream().map(output -> new ImageGeneration.ImageResult(output.key())).toList(),
                ImageGenerationStatus.valueOf(status.name()), error, createdAt, parentGenerationId, parentResultKey);
    }

    public static ContentGeneration fromRunningHub(RunningHubGeneration source, String outputType) {
        MediaType type = MediaType.valueOf(outputType.toUpperCase(java.util.Locale.ROOT));
        List<Output> outputs = source.resultKey() == null ? List.of()
                : List.of(new Output(source.resultKey(), source.resultType(), source.resultContentType()));
        return new ContentGeneration(source.id(), source.userId(), source.pageId(), 1, Provider.RUNNINGHUB,
                type, source.workflowKey(), source.inputs(), source.inputFileKeys(), outputs,
                new ProviderMetadata(source.runningHubTaskId(), source.instanceType()),
                Status.valueOf(source.status().name()), source.error(), source.createdAt(), null, null);
    }

    public RunningHubGeneration toRunningHub() {
        requireProvider(Provider.RUNNINGHUB);
        Output result = outputs.isEmpty() ? null : outputs.getFirst();
        return new RunningHubGeneration(id, userId, pageId, workflowKey, inputs, inputFileKeys,
                result == null ? null : result.key(), result == null ? null : result.type(),
                result == null ? null : result.contentType(),
                providerMetadata == null ? null : providerMetadata.runningHubTaskId(),
                RunningHubGenerationStatus.valueOf(status.name()), error,
                providerMetadata == null ? null : providerMetadata.instanceType(), createdAt);
    }

    private void requireProvider(Provider expected) {
        if (provider != expected) throw new IllegalStateException("Unexpected generation provider: " + provider);
    }
}