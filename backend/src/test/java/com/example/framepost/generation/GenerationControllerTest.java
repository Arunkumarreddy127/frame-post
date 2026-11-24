package com.example.framepost.generation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartHttpServletRequest;

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.config.R2Properties;
import com.example.framepost.creation.CreationService;
import com.example.framepost.creation.CreationService.AddItemRequest;

import software.amazon.awssdk.services.s3.S3Client;

class GenerationControllerTest {
    private final GenerationService generations = mock(GenerationService.class);
    private final CreationService creations = mock(CreationService.class);
    private final AuthService auth = mock(AuthService.class);
    private final User owner = new User("owner", "owner", "hash", Instant.now());
    private final GenerationController controller = new GenerationController(
            generations,
            creations,
            mock(GenerationEvents.class),
            auth,
            mock(S3Client.class),
            new R2Properties(null, null, null, null, null));

    @Test
    void imageGenerationIsPlacedInItsShotBeforeTheResponseReturns() {
        GenerationResponse generation = generation(
                "generation-1", ContentGeneration.Provider.OPENAI);
        when(auth.findBySession("session")).thenReturn(owner);
        when(generations.createImage(eq(owner), eq("page-1"), any(), any())).thenAnswer(invocation -> {
            Consumer<String> onPersisted = invocation.getArgument(3);
            onPersisted.accept(generation.id());
            return generation;
        });

        var response = controller.create("page-1", request(
                "provider", "openai",
                "targetCreationId", "creation-1",
                "targetShotId", "shot-1",
                "targetTool", "IMAGE"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(creations).addItem(
                owner,
                "page-1",
                "creation-1",
                new AddItemRequest("generation-1", null, "shot-1", null, "IMAGE"));
    }

    @Test
    void workflowTargetFieldsAreNotPassedAsWorkflowInputs() {
        GenerationResponse generation = generation(
                "generation-2", ContentGeneration.Provider.RUNNINGHUB);
        when(auth.findBySession("session")).thenReturn(owner);
        when(generations.startWorkflow(
                eq(owner), eq("page-1"), eq("workflow-1"), any(), any(), any(), eq("default")))
                .thenReturn(generation);

        var response = controller.create("page-1", request(
                "provider", "runninghub",
                "workflowKey", "workflow-1",
                "instanceType", "default",
                "prompt", "A meadow",
                "targetCreationId", "creation-1",
                "targetShotId", "shot-1",
                "targetTool", "IMAGE"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        verify(generations).startWorkflow(
                eq(owner),
                eq("page-1"),
                eq("workflow-1"),
                eq(Map.of("prompt", "A meadow")),
                eq(Map.of()),
                eq(Map.of()),
                eq("default"));
        verify(creations).addItem(
                owner,
                "page-1",
                "creation-1",
                new AddItemRequest("generation-2", null, "shot-1", null, "IMAGE"));
    }

    private MockMultipartHttpServletRequest request(String... fields) {
        MockMultipartHttpServletRequest request = new MockMultipartHttpServletRequest();
        request.setCookies(new Cookie("framepost_session", "session"));
        for (int i = 0; i < fields.length; i += 2) {
            request.addParameter(fields[i], fields[i + 1]);
        }
        return request;
    }

    private static GenerationResponse generation(
            String id,
            ContentGeneration.Provider provider
    ) {
        return new GenerationResponse(
                id,
                "page-1",
                provider,
                ContentGeneration.MediaType.IMAGE,
                null,
                "default",
                Map.of(),
                ContentGeneration.Status.COMPLETED,
                null,
                Instant.now(),
                null,
                null,
                List.of(),
                List.of());
    }
}
