package com.example.framepost.runninghub;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Function;

import com.example.framepost.auth.User;
import com.example.framepost.auth.UserRepository;
import com.example.framepost.config.RunningHubProperties;
import com.example.framepost.generation.GenerationEvents;
import com.example.framepost.generation.LibraryFile;
import com.example.framepost.generation.MediaMetadata;
import com.example.framepost.page.PageService;
import com.example.framepost.runninghub.WorkflowDefinition.InputDefinition;
import com.example.framepost.runninghub.WorkflowDefinition.NodeMapping;
import com.example.framepost.runninghub.WorkflowDefinition.OutputDefinition;
import com.example.framepost.runninghub.WorkflowDefinition.Target;
import com.example.framepost.runninghub.WorkflowDefinition.TransformDefinition;
import com.example.framepost.runninghub.transform.InputTransform;
import com.example.framepost.runninghub.transform.TransformInput;
import com.example.framepost.storage.StorageKeys;
import com.example.framepost.storage.StorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Runs any registered RunningHub workflow. Everything workflow-specific comes from its definition. */
@Service
public class RunningHubGenerationService {

    static final long DEFAULT_MAX_FILE_BYTES = 20L * 1024 * 1024;
    private static final Set<String> FILE_TYPES = Set.of("image", "video");
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/png", "png",
            "image/jpeg", "jpg",
            "image/webp", "webp",
            "video/mp4", "mp4",
            "video/quicktime", "mov",
            "video/webm", "webm");

    private static final Logger log = LoggerFactory.getLogger(RunningHubGenerationService.class);

    private final RunningHubGenerationRepository repository;
    private final PageService pageService;
    private final RunningHubProperties properties;
    private final RunningHubClient client;
    private final WorkflowRegistry registry;
    private final StorageService storage;
    private final GenerationEvents events;
    private final Map<String, InputTransform> transforms;
    private final UserRepository users;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final Set<String> finishing = ConcurrentHashMap.newKeySet();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public RunningHubGenerationService(
            RunningHubGenerationRepository repository,
            PageService pageService,
            RunningHubProperties properties,
            RunningHubClient client,
            WorkflowRegistry registry,
            StorageService storage,
            GenerationEvents events,
            List<InputTransform> transforms,
            UserRepository users
    ) {
        this.repository = repository;
        this.pageService = pageService;
        this.properties = properties;
        this.client = client;
        this.registry = registry;
        this.storage = storage;
        this.events = events;
        this.users = users;
        this.transforms = new HashMap<>();
        transforms.forEach(transform -> this.transforms.put(transform.type(), transform));
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    public List<WorkflowView> workflows() {
        return registry.all().stream().map(definition -> WorkflowView.from(definition, registry.workflowId(definition).isPresent())).toList();
    }

    /**
     * Validates the submitted inputs against the definition, derives node values, stores the input files
     * and runs the workflow in the background.
     */
    public GenerationResponse start(User user, String pageId, String workflowKey,
            Map<String, String> textValues, Map<String, MultipartFile> files, String instanceType) {
        return start(user, pageId, workflowKey, textValues, files, Map.of(), instanceType);
    }

    /** Like the upload form, but an input can also name a Library file, which is used by reference. */
    public GenerationResponse start(User user, String pageId, String workflowKey,
            Map<String, String> textValues, Map<String, MultipartFile> files,
            Map<String, LibraryFile> libraryFiles, String instanceType) {
        validateScope(user, pageId);
        WorkflowDefinition definition = definition(workflowKey);
        String workflowId = registry.workflowId(definition).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "RunningHub workflow is not configured"));
        if (isBlank(properties.apiKey())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "RunningHub is not configured");
        }
        
        // Validate and default instanceType
        if (isBlank(instanceType)) {
            instanceType = "default";
        }
        if (!Set.of("default", "plus", "ultra").contains(instanceType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid instanceType: " + instanceType);
        }

        Map<String, String> values = new LinkedHashMap<>();
        Map<String, FileUpload> uploads = new LinkedHashMap<>();
        Map<String, LibraryFile> references = new LinkedHashMap<>();
        Set<String> usedFileNames = new HashSet<>();
        for (InputDefinition input : definition.inputs()) {
            if (FILE_TYPES.contains(input.type())) {
                MultipartFile file = files.get(input.name());
                LibraryFile library = libraryFiles.get(input.name());
                if (file != null && !file.isEmpty() && library != null) {
                    throw badRequest(input.label() + " takes either an upload or a Library file");
                }
                if (library != null) {
                    uploads.put(input.name(), readLibraryFile(input, library));
                    references.put(input.name(), library);
                    continue;
                }
                if (file == null || file.isEmpty()) {
                    requireUnlessOptional(input);
                    continue;
                }
                uploads.put(input.name(), readFile(input, file, usedFileNames));
                continue;
            }
            String value = textValues.get(input.name());
            value = value == null ? "" : value.trim();
            if (value.isEmpty()) {
                if (input.defaultValue() != null) {
                    value = input.defaultValue();
                } else {
                    requireUnlessOptional(input);
                    continue;
                }
            }
            validateText(input, value);
            values.put(input.name(), value);
        }

        List<NodeInfo> nodes = new ArrayList<>();
        for (NodeMapping mapping : definition.nodeMappings()) {
            if (values.containsKey(mapping.input())) {
                nodes.add(new NodeInfo(mapping.nodeId(), mapping.fieldName(), values.get(mapping.input())));
            }
        }
        for (TransformDefinition transform : definition.transforms()) {
            nodes.addAll(applyTransform(definition, transform, values, uploads));
        }

        String id = UUID.randomUUID().toString();
        Map<String, String> inputKeys = new LinkedHashMap<>();
        Map<String, MediaMetadata> metadata = new LinkedHashMap<>();
        for (Map.Entry<String, FileUpload> upload : uploads.entrySet()) {
            LibraryFile reference = references.get(upload.getKey());
            if (reference != null) {
                inputKeys.put(upload.getKey(), reference.key());
                metadata.put(reference.key(), reference.metadata());
                continue;
            }
            String key = StorageKeys.inputPrefix(user, id) + upload.getValue().filename();
            store(key, upload.getValue().bytes(), upload.getValue().contentType());
            inputKeys.put(upload.getKey(), key);
            metadata.put(key, MediaMetadata.of(upload.getValue().bytes(), upload.getValue().contentType()));
        }

        RunningHubGeneration generation = new RunningHubGeneration(id, user.id(), pageId, workflowKey, values, inputKeys,
                null, null, null, null, RunningHubGenerationStatus.PROCESSING, null, instanceType, Instant.now(),
                metadata);
        repository.save(generation);
        executor.execute(() -> process(generation, definition, workflowId, nodes, uploads));
        return GenerationResponse.from(generation, storage::publicUrl);
    }

    private List<NodeInfo> applyTransform(WorkflowDefinition definition, TransformDefinition transform,
            Map<String, String> values, Map<String, FileUpload> uploads) {
        InputTransform implementation = transforms.get(transform.type());
        Map<String, String> roleValues = new HashMap<>();
        Map<String, byte[]> roleFiles = new HashMap<>();
        for (Map.Entry<String, String> role : transform.inputs().entrySet()) {
            String inputName = role.getValue();
            if (values.containsKey(inputName)) {
                roleValues.put(role.getKey(), values.get(inputName));
            } else if (uploads.containsKey(inputName)) {
                roleFiles.put(role.getKey(), uploads.get(inputName).bytes());
            }
        }
        Map<String, String> outputs;
        try {
            outputs = implementation.apply(new TransformInput(roleValues, roleFiles),
                    transform.params() == null ? Map.of() : transform.params());
        } catch (IllegalArgumentException exception) {
            throw badRequest(exception.getMessage());
        }
        List<NodeInfo> nodes = new ArrayList<>();
        for (Map.Entry<String, Target> target : transform.targets().entrySet()) {
            nodes.add(new NodeInfo(target.getValue().nodeId(), target.getValue().fieldName(), outputs.get(target.getKey())));
        }
        return nodes;
    }

    private void process(RunningHubGeneration initial, WorkflowDefinition definition, String workflowId,
            List<NodeInfo> nodes, Map<String, FileUpload> uploads) {
        String id = initial.id();
        try {
            List<NodeInfo> allNodes = new ArrayList<>(nodes);
            Map<String, String> uploaded = new HashMap<>();
            for (NodeMapping mapping : definition.nodeMappings()) {
                FileUpload upload = uploads.get(mapping.input());
                if (upload == null) {
                    continue;
                }
                if (!uploaded.containsKey(mapping.input())) {
                    uploaded.put(mapping.input(),
                            client.uploadFile(upload.fileType(), upload.bytes(), upload.filename(), upload.contentType()));
                }
                allNodes.add(new NodeInfo(mapping.nodeId(), mapping.fieldName(), uploaded.get(mapping.input())));
            }
            String taskId = client.createTask(workflowId, allNodes, webhookUrl(), initial.instanceType());
            repository.findById(id).ifPresent(generation -> repository.save(generation.withTaskId(taskId)));
            awaitTask(id, definition, taskId);
        } catch (RuntimeException exception) {
            log.warn("RunningHub generation {} failed", id, exception);
            failIfProcessing(id, failureMessage(exception));
        }
    }

    /** Accepts RunningHub's completion callback. The payload only identifies the task; status is re-checked with RunningHub. */
    public void handleWebhook(String secret, String body) {
        if (isBlank(properties.webhookSecret()) || !MessageDigest.isEqual(
                secret.getBytes(StandardCharsets.UTF_8), properties.webhookSecret().getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        String taskId = taskIdFrom(body);
        if (taskId == null) {
            return;
        }
        repository.findByRunningHubTaskId(taskId)
                .ifPresent(generation -> executor.execute(() -> checkTask(generation, taskId)));
    }

    private void checkTask(RunningHubGeneration generation, String taskId) {
        try {
            if (!isProcessing(generation.id())) {
                return;
            }
            WorkflowDefinition definition = registry.find(generation.workflowKey()).orElse(null);
            if (definition == null) {
                failIfProcessing(generation.id(), "Workflow no longer exists");
                return;
            }
            applyStatus(generation.id(), definition, taskId, client.taskStatus(taskId));
        } catch (RuntimeException exception) {
            log.warn("Could not check RunningHub task {} after webhook", generation.id(), exception);
        }
    }

    private void awaitTask(String id, WorkflowDefinition definition, String taskId) {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(properties.maxWaitSeconds()));
        while (isProcessing(id)) {
            if (applyStatus(id, definition, taskId, client.taskStatus(taskId))) {
                return;
            }
            if (Instant.now().isAfter(deadline)) {
                failIfProcessing(id, "Generation timed out");
                return;
            }
            try {
                Thread.sleep(Duration.ofSeconds(properties.pollIntervalSeconds()));
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                failIfProcessing(id, "Generation was interrupted");
                return;
            }
        }
    }

    /** Returns true when the task reached a final state. */
    private boolean applyStatus(String id, WorkflowDefinition definition, String taskId, String status) {
        if ("SUCCESS".equalsIgnoreCase(status)) {
            finishTask(id, definition, taskId);
            return true;
        }
        if ("FAILED".equalsIgnoreCase(status) || "CANCELLED".equalsIgnoreCase(status)) {
            failIfProcessing(id, "RunningHub could not generate the output");
            return true;
        }
        return false;
    }

    /** Downloads the output and completes the record. Guarded so the webhook and the poller never both finish one task. */
    private void finishTask(String id, WorkflowDefinition definition, String taskId) {
        if (!finishing.add(id)) {
            return;
        }
        try {
            RunningHubGeneration generation = repository.findById(id)
                    .filter(current -> current.status() == RunningHubGenerationStatus.PROCESSING)
                    .orElse(null);
            if (generation == null) {
                return;
            }
            OutputDefinition output = definition.output();
            String extension = output.extensions().getFirst();
            byte[] bytes = client.download(client.outputUrl(taskId, output.extensions()));
            User owner = users.findById(generation.userId())
                    .orElseThrow(() -> new RunningHubException("Generation owner no longer exists"));
            String key = StorageKeys.outputPrefix(owner, id) + generation.workflowKey() + "-output." + extension;
            store(key, bytes, output.contentType());
            publish(repository.save(generation.completed(key, output.type(), output.contentType(),
                    MediaMetadata.of(bytes, output.contentType()))));
        } catch (RuntimeException exception) {
            log.warn("RunningHub generation {} could not be completed", id, exception);
            failIfProcessing(id, failureMessage(exception));
        } finally {
            finishing.remove(id);
        }
    }

    private boolean isProcessing(String id) {
        return repository.findById(id)
                .map(generation -> generation.status() == RunningHubGenerationStatus.PROCESSING)
                .orElse(false);
    }

    private void failIfProcessing(String id, String message) {
        repository.findById(id)
                .filter(generation -> generation.status() == RunningHubGenerationStatus.PROCESSING)
                .ifPresent(generation -> publish(repository.save(generation.failed(message))));
    }

    private void publish(RunningHubGeneration generation) {
        events.publish(generation.id());
    }

    private static String failureMessage(RuntimeException exception) {
        return exception instanceof RunningHubException ? exception.getMessage() : "Generation failed";
    }

    private String webhookUrl() {
        if (isBlank(properties.webhookBaseUrl()) || isBlank(properties.webhookSecret())) {
            return null;
        }
        return properties.webhookBaseUrl().replaceAll("/$", "") + "/api/webhooks/runninghub/" + properties.webhookSecret();
    }

    private String taskIdFrom(String body) {
        if (isBlank(body)) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(body);
            String taskId = root.path("taskId").asText("");
            if (taskId.isBlank()) {
                taskId = root.path("data").path("taskId").asText("");
            }
            return taskId.isBlank() ? null : taskId;
        } catch (IOException exception) {
            return null;
        }
    }

    private FileUpload readFile(InputDefinition input, MultipartFile file, Set<String> usedNames) {
        String contentType = file.getContentType();
        if (contentType == null || input.accept() == null || !input.accept().contains(contentType)) {
            throw badRequest(input.label() + " must be one of: " + String.join(", ", input.accept()));
        }
        long maxBytes = input.maxBytes() == null ? DEFAULT_MAX_FILE_BYTES : input.maxBytes();
        if (file.getSize() > maxBytes) {
            throw badRequest(input.label() + " must be " + maxBytes / (1024 * 1024) + " MB or smaller");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw badRequest("Unable to read " + input.label());
        }
        String extension = EXTENSIONS.getOrDefault(contentType, "bin");
        String name = StorageKeys.fileName(file.getOriginalFilename(), extension, input.name(), usedNames);
        return new FileUpload(input.type(), name, contentType, bytes);
    }

    private FileUpload readLibraryFile(InputDefinition input, LibraryFile file) {
        if (input.accept() == null || !input.accept().contains(file.contentType())) {
            throw badRequest(input.label() + " must be one of: " + String.join(", ", input.accept()));
        }
        long maxBytes = input.maxBytes() == null ? DEFAULT_MAX_FILE_BYTES : input.maxBytes();
        if (file.bytes().length > maxBytes) {
            throw badRequest(input.label() + " must be " + maxBytes / (1024 * 1024) + " MB or smaller");
        }
        return new FileUpload(input.type(), file.name(), file.contentType(), file.bytes());
    }

    private void validateText(InputDefinition input, String value) {
        if (input.maxLength() != null && value.length() > input.maxLength()) {
            throw badRequest(input.label() + " must be " + input.maxLength() + " characters or fewer");
        }
        if ("select".equals(input.type()) && !input.options().contains(value)) {
            throw badRequest(input.label() + " must be one of: " + String.join(", ", input.options()));
        }
        if ("number".equals(input.type())) {
            double number;
            try {
                number = Double.parseDouble(value);
            } catch (NumberFormatException exception) {
                throw badRequest(input.label() + " must be a number");
            }
            if ((input.min() != null && number < input.min()) || (input.max() != null && number > input.max())) {
                throw badRequest(input.label() + " is out of range");
            }
        }
    }

    private static void requireUnlessOptional(InputDefinition input) {
        if (input.required()) {
            throw badRequest(input.label() + " is required");
        }
    }

    private WorkflowDefinition definition(String workflowKey) {
        return registry.find(workflowKey)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workflow not found"));
    }

    private void store(String key, byte[] bytes, String contentType) {
        storage.store(key, new ByteArrayInputStream(bytes), bytes.length, contentType);
    }

    private void validateScope(User user, String pageId) {
        if (pageId != null) {
            pageService.get(user, pageId);
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    /** An uploaded file that is kept until the workflow has run. */
    record FileUpload(String fileType, String filename, String contentType, byte[] bytes) {
    }

    /** The workflow description the frontend renders from. It omits workflow and node IDs. */
    public record WorkflowView(
            String key,
            String label,
            String description,
            String group,
            boolean configured,
            List<InputDefinition> inputs,
            String outputType,
            String outputContentType
    ) {
        static WorkflowView from(WorkflowDefinition definition, boolean configured) {
            return new WorkflowView(definition.key(), definition.label(), definition.description(), definition.group(),
                    configured, definition.inputs(), definition.output().type(), definition.output().contentType());
        }
    }

    public record GenerationResponse(
            String id,
            String pageId,
            String workflowKey,
            RunningHubGenerationStatus status,
            String error,
            Map<String, String> inputs,
            Map<String, String> inputUrls,
            String resultType,
            String resultUrl,
            String resultContentType,
            Instant createdAt
    ) {
        static GenerationResponse from(RunningHubGeneration generation, Function<String, String> publicUrl) {
            Map<String, String> inputUrls = new LinkedHashMap<>();
            if (generation.inputFileKeys() != null) {
                generation.inputFileKeys().forEach((name, key) -> inputUrls.put(name, publicUrl.apply(key)));
            }
            return new GenerationResponse(
                    generation.id(),
                    generation.pageId(),
                    generation.workflowKey(),
                    generation.status(),
                    generation.error(),
                    generation.inputs(),
                    inputUrls,
                    generation.resultType(),
                    generation.resultKey() == null ? null : publicUrl.apply(generation.resultKey()),
                    generation.resultContentType(),
                    generation.createdAt());
        }
    }
}
