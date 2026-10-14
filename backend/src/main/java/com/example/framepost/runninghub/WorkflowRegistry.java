package com.example.framepost.runninghub;

import java.io.IOException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

import com.example.framepost.runninghub.WorkflowDefinition.InputDefinition;
import com.example.framepost.runninghub.WorkflowDefinition.NodeMapping;
import com.example.framepost.runninghub.WorkflowDefinition.TransformDefinition;
import com.example.framepost.runninghub.transform.InputTransform;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.env.Environment;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

/**
 * Loads RunningHub workflow definitions from {@code runninghub/workflows/*.json} on the classpath,
 * validates them at startup, and resolves each workflow ID from its environment variable.
 */
@Component
public class WorkflowRegistry {

    static final String DEFINITION_PATTERN = "classpath*:runninghub/workflows/*.json";
    static final Set<String> FILE_TYPES = Set.of("image", "video");
    static final Set<String> INPUT_TYPES = Set.of("image", "video", "text", "textarea", "select", "number");
    static final Set<String> OUTPUT_TYPES = Set.of("video", "image");

    private static final Pattern KEY = Pattern.compile("[a-z0-9]+(-[a-z0-9]+)*");

    private final Map<String, WorkflowDefinition> definitions;
    private final Environment environment;

    @org.springframework.beans.factory.annotation.Autowired
    public WorkflowRegistry(List<InputTransform> transforms, Environment environment) throws IOException {
        this(loadClasspath(), transforms, environment);
    }

    WorkflowRegistry(List<WorkflowDefinition> definitions, List<InputTransform> transforms, Environment environment) {
        this.environment = environment;
        Map<String, InputTransform> transformsByType = new HashMap<>();
        for (InputTransform transform : transforms) {
            transformsByType.put(transform.type(), transform);
        }
        Map<String, WorkflowDefinition> byKey = new LinkedHashMap<>();
        for (WorkflowDefinition definition : definitions) {
            validate(definition, transformsByType);
            if (byKey.putIfAbsent(definition.key(), definition) != null) {
                throw new IllegalStateException("Duplicate RunningHub workflow key: " + definition.key());
            }
        }
        this.definitions = Map.copyOf(byKey);
    }

    public List<WorkflowDefinition> all() {
        return List.copyOf(definitions.values());
    }

    public Optional<WorkflowDefinition> find(String key) {
        return Optional.ofNullable(definitions.get(key));
    }

    /** Returns the RunningHub workflow ID from the definition's env var. */
    public Optional<String> workflowId(WorkflowDefinition definition) {
        String value = environment.getProperty(definition.workflowIdEnv());
        return isBlank(value) ? Optional.empty() : Optional.of(value);
    }

    private static List<WorkflowDefinition> loadClasspath() throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        Resource[] resources = new PathMatchingResourcePatternResolver().getResources(DEFINITION_PATTERN);
        Arrays.sort(resources, Comparator.comparing(resource -> resource.getFilename() == null ? "" : resource.getFilename()));
        return Arrays.stream(resources).map(resource -> read(mapper, resource)).toList();
    }

    private static WorkflowDefinition read(ObjectMapper mapper, Resource resource) {
        try (var stream = resource.getInputStream()) {
            return mapper.readValue(stream, WorkflowDefinition.class);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read RunningHub workflow " + resource.getFilename(), exception);
        }
    }

    static void validate(WorkflowDefinition definition, Map<String, InputTransform> transformsByType) {
        String where = "RunningHub workflow " + (definition == null ? "?" : definition.key());
        if (definition == null || isBlank(definition.key()) || !KEY.matcher(definition.key()).matches()) {
            throw new IllegalStateException("Invalid workflow key in " + where);
        }
        require(!isBlank(definition.label()), where, "label is required");
        require(!isBlank(definition.workflowIdEnv()), where, "workflowIdEnv is required");
        require(definition.inputs() != null && !definition.inputs().isEmpty(), where, "at least one input is required");
        require(definition.output() != null, where, "output is required");
        require(OUTPUT_TYPES.contains(definition.output().type()), where, "unknown output type");
        require(!isBlank(definition.output().contentType()), where, "output contentType is required");
        require(definition.output().extensions() != null && !definition.output().extensions().isEmpty(),
                where, "output extensions are required");

        Map<String, InputDefinition> inputs = new HashMap<>();
        for (InputDefinition input : definition.inputs()) {
            require(!isBlank(input.name()), where, "input name is required");
            require(inputs.put(input.name(), input) == null, where, "duplicate input " + input.name());
            require(INPUT_TYPES.contains(input.type()), where, "unknown input type " + input.type());
            require(!isBlank(input.label()), where, "input " + input.name() + " needs a label");
            if (FILE_TYPES.contains(input.type())) {
                require(input.accept() != null && !input.accept().isEmpty(), where,
                        "file input " + input.name() + " needs accept types");
            }
            if ("select".equals(input.type())) {
                require(input.options() != null && !input.options().isEmpty(), where,
                        "select input " + input.name() + " needs options");
                require(input.defaultValue() == null || input.options().contains(input.defaultValue()), where,
                        "default of " + input.name() + " is not an option");
            }
        }

        Set<String> used = new HashSet<>();
        for (NodeMapping mapping : definition.nodeMappings() == null ? List.<NodeMapping>of() : definition.nodeMappings()) {
            require(inputs.containsKey(mapping.input()), where, "node mapping refers to unknown input " + mapping.input());
            require(!isBlank(mapping.nodeId()) && !isBlank(mapping.fieldName()), where,
                    "node mapping for " + mapping.input() + " needs nodeId and fieldName");
            used.add(mapping.input());
        }

        for (TransformDefinition transform : definition.transforms() == null
                ? List.<TransformDefinition>of() : definition.transforms()) {
            InputTransform implementation = transformsByType.get(transform.type());
            require(implementation != null, where, "unknown transform " + transform.type());
            Map<String, String> roles = transform.inputs() == null ? Map.of() : transform.inputs();
            require(roles.keySet().equals(implementation.roles()), where,
                    "transform " + transform.type() + " needs roles " + implementation.roles());
            for (String inputName : roles.values()) {
                require(inputs.containsKey(inputName), where, "transform refers to unknown input " + inputName);
                used.add(inputName);
            }
            Map<String, ?> targets = transform.targets() == null ? Map.of() : transform.targets();
            require(!targets.isEmpty(), where, "transform " + transform.type() + " needs targets");
            for (Map.Entry<String, ?> target : targets.entrySet()) {
                require(implementation.outputs().contains(target.getKey()), where,
                        "transform " + transform.type() + " has no output " + target.getKey());
            }
        }

        for (String name : inputs.keySet()) {
            require(used.contains(name), where, "input " + name + " is not mapped to a node");
        }
    }

    private static void require(boolean condition, String where, String message) {
        if (!condition) {
            throw new IllegalStateException(where + ": " + message);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
