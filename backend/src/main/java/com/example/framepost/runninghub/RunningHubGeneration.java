package com.example.framepost.runninghub;

import java.time.Instant;
import java.util.Map;

import org.springframework.data.annotation.Id;

/**
 * One run of a RunningHub workflow. {@code inputs} holds text values and {@code inputFileKeys}
 * maps each file input name to its stored object key. {@code instanceType} tracks the selected
 * GPU tier: "default" (24GB), "plus" (48GB), or "ultra" (84GB).
 */
public record RunningHubGeneration(
        @Id String id,
    String userId,
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
        String instanceType,
        Instant createdAt
) {

    RunningHubGeneration withTaskId(String taskId) {
        return new RunningHubGeneration(id, userId, pageId, workflowKey, inputs, inputFileKeys, resultKey, resultType,
                resultContentType, taskId, status, error, instanceType, createdAt);
    }

    RunningHubGeneration completed(String key, String type, String contentType) {
        return new RunningHubGeneration(id, userId, pageId, workflowKey, inputs, inputFileKeys, key, type, contentType,
                runningHubTaskId, RunningHubGenerationStatus.COMPLETED, null, instanceType, createdAt);
    }

    RunningHubGeneration failed(String message) {
        return new RunningHubGeneration(id, userId, pageId, workflowKey, inputs, inputFileKeys, resultKey, resultType,
                resultContentType, runningHubTaskId, RunningHubGenerationStatus.FAILED, message, instanceType, createdAt);
    }
}
