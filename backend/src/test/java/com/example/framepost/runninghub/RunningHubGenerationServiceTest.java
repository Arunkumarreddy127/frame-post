package com.example.framepost.runninghub;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import com.example.framepost.auth.User;
import com.example.framepost.auth.UserRepository;
import com.example.framepost.config.RunningHubProperties;
import com.example.framepost.page.PageService;
import com.example.framepost.runninghub.transform.AspectRatioDimensionsTransform;
import com.example.framepost.runninghub.transform.InputTransform;
import com.example.framepost.runninghub.transform.SecondsToFramesTransform;
import com.example.framepost.storage.StorageService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

class RunningHubGenerationServiceTest {

    private static final String MINIMAX = "minimax-h3-ff-image-to-video";
    private static final String OUTPUT_URL = "https://cdn.example/out.mp4";

    private final Map<String, RunningHubGeneration> rows = new ConcurrentHashMap<>();
    private final RunningHubGenerationRepository repository = mock(RunningHubGenerationRepository.class);
    private final PageService pageService = mock(PageService.class);
    private final RunningHubClient client = mock(RunningHubClient.class);
    private final StorageService storage = mock(StorageService.class);
    private final User user = new User("user-1", "name", "hash", Instant.now());

    private final MockEnvironment env = new MockEnvironment()
            .withProperty("RUNNINGHUB_WORKFLOW_ID_MINIMAX_H3_FF", "workflow-1");
    private final List<InputTransform> transforms = List.of(
            new SecondsToFramesTransform(), new AspectRatioDimensionsTransform());

    private final RunningHubProperties properties = new RunningHubProperties(
            "key", "https://www.runninghub.ai", 60, 0, 60, "https://test1.oneappstore.in", "s3cret");

    private RunningHubGenerationService service() throws Exception {
        return service(properties, env);
    }

    private RunningHubGenerationService service(RunningHubProperties props, MockEnvironment environment)
            throws Exception {
        WorkflowRegistry registry = new WorkflowRegistry(transforms, environment);
        UserRepository users = mock(UserRepository.class);
        when(users.findById("user-1")).thenReturn(Optional.of(user));
        return new RunningHubGenerationService(repository, pageService, props, client, registry, storage,
                new RunningHubGenerationEvents(), transforms, users);
    }

    @Test
    void completesGenerationByPollingAndStoresVideo() throws Exception {
        stubRepository();
        when(client.uploadFile(any(), any(), eq("frame.png"), eq("image/png"))).thenReturn("api/frame.png");
        when(client.createTask(eq("workflow-1"), any(), any())).thenReturn("task-1");
        when(client.taskStatus("task-1")).thenReturn("RUNNING", "SUCCESS");
        when(client.outputUrl(eq("task-1"), any())).thenReturn(OUTPUT_URL);
        when(client.download(OUTPUT_URL)).thenReturn(new byte[] {7, 8});

        RunningHubGenerationService service = service();
        RunningHubGenerationService.GenerationResponse started = service.start(
                user, null, MINIMAX, Map.of("prompt", "a drone shot"), Map.of("image", png()));

        verify(client, timeout(2000)).createTask(eq("workflow-1"), argThat(nodes ->
                nodes.contains(new NodeInfo("236", "image", "api/frame.png"))
                        && nodes.contains(new NodeInfo("222", "prompt", "a drone shot"))
                        && nodes.contains(new NodeInfo("222", "length", "192"))
                        && nodes.contains(new NodeInfo("222", "width", "768"))
                        && nodes.contains(new NodeInfo("222", "height", "1344"))), any());
        verify(storage, timeout(2000)).store(eq("outputs/name-user-1/" + started.id() + "/minimax-h3-ff-image-to-video-output.mp4"),
                any(), eq(2L), eq("video/mp4"));
        verify(repository, timeout(2000)).save(argThat(saved ->
                saved.status() == RunningHubGenerationStatus.COMPLETED && "video".equals(saved.resultType())));
    }

    @Test
    void webhookCompletesGenerationWithoutWaitingForPolling() throws Exception {
        stubRepository();
        rows.put("gen-3", new RunningHubGeneration("gen-3", user.id(), null, MINIMAX, Map.of(), Map.of(),
                null, null, null, "task-3", RunningHubGenerationStatus.PROCESSING, null, Instant.now()));
        when(client.taskStatus("task-3")).thenReturn("SUCCESS");
        when(client.outputUrl(eq("task-3"), any())).thenReturn(OUTPUT_URL);
        when(client.download(OUTPUT_URL)).thenReturn(new byte[] {7, 8});

        service().handleWebhook("s3cret", "{\"taskId\":\"task-3\",\"data\":[]}");

        verify(storage, timeout(2000)).store(eq("outputs/name-user-1/gen-3/minimax-h3-ff-image-to-video-output.mp4"), any(), eq(2L),
                eq("video/mp4"));
        verify(repository, timeout(2000)).save(argThat(saved -> saved.status() == RunningHubGenerationStatus.COMPLETED));
    }

    @Test
    void webhookWithWrongSecretIsRejected() throws Exception {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service().handleWebhook("wrong", "{\"taskId\":\"task-3\"}"));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        verify(repository, never()).findByRunningHubTaskId(anyString());
    }

    @Test
    void marksGenerationFailedWhenRunningHubFails() throws Exception {
        stubRepository();
        when(client.createTask(eq("workflow-1"), any(), any()))
                .thenThrow(new RunningHubException("RunningHub is down"));

        service().start(user, null, MINIMAX, Map.of("prompt", "prompt"), Map.of("image", png()));

        verify(repository, timeout(2000)).save(argThat(saved ->
                saved.status() == RunningHubGenerationStatus.FAILED && "RunningHub is down".equals(saved.error())));
    }

    @Test
    void rejectsMissingPromptAndUnsupportedImage() throws Exception {
        RunningHubGenerationService service = service();
        MockMultipartFile gif = new MockMultipartFile("image", "frame.gif", "image/gif", new byte[] {1});

        assertBadRequest(() -> service.start(user, null, MINIMAX, Map.of("prompt", "  "), Map.of("image", png())));
        assertBadRequest(() -> service.start(user, null, MINIMAX, Map.of("prompt", "prompt"), Map.of("image", gif)));
    }

    @Test
    void rejectsSelectValueOutsideDefinitionOptions() throws Exception {
        RunningHubGenerationService service = service();

        assertBadRequest(() -> service.start(user, null, MINIMAX,
                Map.of("prompt", "prompt", "duration", "9"), Map.of("image", png())));
    }

    @Test
    void rejectsUnknownWorkflowKey() throws Exception {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service().start(user, null, "no-such-workflow", Map.of(), Map.of()));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void reportsNotConfiguredWhenApiKeyMissing() throws Exception {
        RunningHubProperties unconfigured = new RunningHubProperties(
                "", "https://www.runninghub.ai", 60, 0, 60, "", "");

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service(unconfigured, env).start(user, null, MINIMAX,
                        Map.of("prompt", "prompt"), Map.of("image", png())));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
    }

    @Test
    void reportsNotConfiguredWhenWorkflowIdEnvMissing() throws Exception {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service(properties, new MockEnvironment()).start(user, null, MINIMAX,
                        Map.of("prompt", "prompt"), Map.of("image", png())));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
    }

    private void stubRepository() {
        when(repository.save(any())).thenAnswer(invocation -> {
            RunningHubGeneration generation = invocation.getArgument(0);
            rows.put(generation.id(), generation);
            return generation;
        });
        when(repository.findById(anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(rows.get(invocation.<String>getArgument(0))));
        when(repository.findByRunningHubTaskId(anyString())).thenAnswer(invocation -> {
            String taskId = invocation.getArgument(0);
            return rows.values().stream().filter(row -> taskId.equals(row.runningHubTaskId())).findFirst();
        });
    }

    private static MultipartFile png() {
        return new MockMultipartFile("image", "frame.png", "image/png", new byte[] {1});
    }

    private static void assertBadRequest(org.junit.jupiter.api.function.Executable action) {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, action);
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }
}
