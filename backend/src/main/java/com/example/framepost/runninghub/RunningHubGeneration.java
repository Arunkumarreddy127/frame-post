package com.example.framepost.runninghub;

import java.time.Instant;
import java.util.Map;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One run of a RunningHub workflow. {@code inputs} holds text values and {@code inputFileKeys}
 * maps each file input name to its stored object key.
 */
@Document("runninghub_generations")
@CompoundIndex(name = "user_scope_created", def = "{'userId': 1, 'pageId': 1, 'workflowKey': 1, 'createdAt': -1}")
public record RunningHubGeneration(
        @Id String id,
        @Indexed String userId,
        String pageId,
        String workflowKey,
        Map<String, String> inputs,
        Map<String, String> inputFileKeys,
        String resultKey,
        String resultType,
        String resultContentType,
        String runningHubTaskId,
        RunningHubGenerationStatus status,
        String error,
        Instant createdAt
) {

    RunningHubGeneration withTaskId(String taskId) {
        return new RunningHubGeneration(id, userId, pageId, workflowKey, inputs, inputFileKeys, resultKey, resultType,
                resultContentType, taskId, status, error, createdAt);
    }

    RunningHubGeneration completed(String key, String type, String contentType) {
        return new RunningHubGeneration(id, userId, pageId, workflowKey, inputs, inputFileKeys, key, type, contentType,
                runningHubTaskId, RunningHubGenerationStatus.COMPLETED, null, createdAt);
    }

    RunningHubGeneration failed(String message) {
        return new RunningHubGeneration(id, userId, pageId, workflowKey, inputs, inputFileKeys, resultKey, resultType,
                resultContentType, runningHubTaskId, RunningHubGenerationStatus.FAILED, message, createdAt);
    }
}
