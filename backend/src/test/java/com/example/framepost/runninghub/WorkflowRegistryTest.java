package com.example.framepost.runninghub;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.example.framepost.runninghub.WorkflowDefinition.NodeMapping;
import com.example.framepost.runninghub.WorkflowDefinition.Target;
import com.example.framepost.runninghub.WorkflowDefinition.TransformDefinition;
import com.example.framepost.runninghub.transform.AspectRatioDimensionsTransform;
import com.example.framepost.runninghub.transform.InputTransform;
import com.example.framepost.runninghub.transform.SecondsToFramesTransform;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class WorkflowRegistryTest {

    private static final String MINIMAX = "minimax-h3-ff-image-to-video";
    private static final String SEEDVR2 = "seedvr2-video-upscale";

    /** Export file for each definition key, relative to the backend module directory. */
    private static final Map<String, String> EXPORTS = Map.of(
            MINIMAX, "../resources/Minimax H3 - FF Image to Video_api.json",
            SEEDVR2, "../resources/SeedVR2 - Video Upscale_api.json");

    private final List<InputTransform> transforms = List.of(
            new SecondsToFramesTransform(), new AspectRatioDimensionsTransform());

    @Test
    void loadsBundledDefinitions() throws IOException {
        WorkflowRegistry registry = new WorkflowRegistry(transforms, new MockEnvironment());

        assertTrue(registry.find(MINIMAX).isPresent());
        assertTrue(registry.find(SEEDVR2).isPresent());
        assertEquals(2, registry.all().size());
    }

    @Test
    void resolvesWorkflowIdFromNamedEnvVar() throws IOException {
        MockEnvironment env = new MockEnvironment();
        WorkflowRegistry registry = new WorkflowRegistry(transforms, env);
        WorkflowDefinition minimax = registry.find(MINIMAX).orElseThrow();

        assertFalse(registry.workflowId(minimax).isPresent());

        env.withProperty("RUNNINGHUB_WORKFLOW_ID_MINIMAX_H3_FF", "new-id");
        assertEquals(Optional.of("new-id"), registry.workflowId(minimax));
    }

    @Test
    void reportsMissingWorkflowIdWhenNoEnvVarIsSet() throws IOException {
        WorkflowRegistry registry = new WorkflowRegistry(transforms, new MockEnvironment());

        assertFalse(registry.workflowId(registry.find(SEEDVR2).orElseThrow()).isPresent());
    }

    @Test
    void rejectsMappingThatReferencesUndeclaredInput() throws IOException {
        WorkflowDefinition base = new WorkflowRegistry(transforms, new MockEnvironment())
                .find(MINIMAX).orElseThrow();
        WorkflowDefinition broken = withNodeMappings(base,
                List.of(new NodeMapping("ghost", "222", "prompt")));

        assertThrows(IllegalStateException.class,
                () -> new WorkflowRegistry(List.of(broken), transforms, new MockEnvironment()));
    }

    @Test
    void rejectsTransformWithUnknownType() throws IOException {
        WorkflowDefinition base = new WorkflowRegistry(transforms, new MockEnvironment())
                .find(MINIMAX).orElseThrow();
        TransformDefinition unknown = new TransformDefinition("noSuchTransform", Map.of(), Map.of(), Map.of());
        WorkflowDefinition broken = new WorkflowDefinition(
                base.key(), base.label(), base.description(), base.group(), base.workflowIdEnv(),
                base.inputs(), base.nodeMappings(), List.of(unknown), base.output());

        assertThrows(IllegalStateException.class,
                () -> new WorkflowRegistry(List.of(broken), transforms, new MockEnvironment()));
    }

    @Test
    void everyNodeAndFieldInDefinitionExistsInExportedWorkflow() throws IOException {
        WorkflowRegistry registry = new WorkflowRegistry(transforms, new MockEnvironment());
        ObjectMapper mapper = new ObjectMapper();

        for (WorkflowDefinition definition : registry.all()) {
            JsonNode export = mapper.readTree(new File(EXPORTS.get(definition.key())));
            for (NodeMapping mapping : definition.nodeMappings()) {
                assertFieldExists(export, definition.key(), mapping.nodeId(), mapping.fieldName());
            }
            for (TransformDefinition transform : definition.transforms()) {
                for (Target target : transform.targets().values()) {
                    assertFieldExists(export, definition.key(), target.nodeId(), target.fieldName());
                }
            }
        }
    }

    private static void assertFieldExists(JsonNode export, String key, String nodeId, String fieldName) {
        JsonNode inputs = export.path(nodeId).path("inputs");
        assertTrue(inputs.has(fieldName),
                () -> key + " references node " + nodeId + " field '" + fieldName + "' missing from export");
    }

    private static WorkflowDefinition withNodeMappings(WorkflowDefinition base, List<NodeMapping> mappings) {
        return new WorkflowDefinition(
                base.key(), base.label(), base.description(), base.group(), base.workflowIdEnv(),
                base.inputs(), mappings, base.transforms(), base.output());
    }
}
