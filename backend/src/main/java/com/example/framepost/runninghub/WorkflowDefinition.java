package com.example.framepost.runninghub;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;

public record WorkflowDefinition(
        String key,
        String label,
        String description,
        String group,
        String workflowIdEnv,
        List<InputDefinition> inputs,
        List<NodeMapping> nodeMappings,
        List<TransformDefinition> transforms,
        OutputDefinition output) {

    public record InputDefinition(
            String name,
            String type,
            String label,
            boolean required,
            List<String> accept,
            Long maxBytes,
            Integer maxLength,
            List<String> options,
            @JsonProperty("default") String defaultValue,
            Double min,
            Double max) {
    }

    public record NodeMapping(String input, String nodeId, String fieldName) {
    }

    /**
     * A named derivation. {@code inputs} maps the transform's role names to input names,
     * {@code params} holds constants, and {@code targets} maps each produced output name
     * to the node field that receives it.
     */
    public record TransformDefinition(
            String type,
            Map<String, String> inputs,
            Map<String, String> params,
            Map<String, Target> targets) {
    }

    public record Target(String nodeId, String fieldName) {
    }

    public record OutputDefinition(String type, String contentType, List<String> extensions) {
    }
}
