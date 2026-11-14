package com.example.framepost.generation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.User;
import com.example.framepost.generation.ContentGenerationStore.Hydrated;
import com.example.framepost.image.ImageGenerationService;
import com.example.framepost.page.PageService;
import com.example.framepost.runninghub.RunningHubGenerationService;
import com.example.framepost.storage.StorageService;

class GenerationServiceTest {
    private final ContentGenerationStore store = mock(ContentGenerationStore.class);
    private final PageService pages = mock(PageService.class);
    private final StorageService storage = mock(StorageService.class);
    private final User owner = new User("owner", "owner", "hash", Instant.now());
    private final GenerationService service = new GenerationService(
            store,
            pages,
            storage,
            mock(ImageGenerationService.class),
            mock(RunningHubGenerationService.class),
            mock(LibraryFileResolver.class));

    @BeforeEach
    void resetMocks() {
        org.mockito.Mockito.reset(store, pages, storage);
    }

    @Test
    void childrenAreScopedToTheParentPageAndPaginated() {
        ContentGeneration parent = generation("parent", "owner", "page-1", null);
        ContentGeneration child = generation("child", "owner", "page-1", "parent");
        when(store.find("parent")).thenReturn(Optional.of(new Hydrated(parent, List.of(), List.of())));
        when(store.queryChildren("owner", "page-1", "parent", null, 3)).thenReturn(List.of(child));
        when(store.hydrate(List.of(child))).thenReturn(List.of(new Hydrated(child, List.of(), List.of())));

        PagedResponse<GenerationResponse> response = service.children(owner, "page-1", "parent", null, 2);

        assertThat(response.items()).extracting(GenerationResponse::id).containsExactly("child");
        assertThat(response.nextCursor()).isNull();
        verify(store).queryChildren("owner", "page-1", "parent", null, 3);
    }

    @Test
    void childrenAreNotReturnedForAnotherUsersParent() {
        ContentGeneration parent = generation("parent", "someone-else", null, null);
        when(store.find("parent")).thenReturn(Optional.of(new Hydrated(parent, List.of(), List.of())));

        assertThatThrownBy(() -> service.children(owner, null, "parent", null, 10))
                .isInstanceOf(ResponseStatusException.class);

        verify(store, never()).queryChildren(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void libraryMediaIncludesItsGenerationLineage() {
        ContentOutput output = new ContentOutput(
                "generation:out:0", "generation", "owner", null, "image", 0, "output.png", null,
                "output.png", "image/png", "image", 120L, 10, 10, null, Instant.now());
        ContentGeneration generation = new ContentGeneration(
                "generation",
                "owner",
                null,
                2,
                ContentGeneration.Provider.OPENAI,
                ContentGeneration.MediaType.IMAGE,
                null,
                Map.of("prompt", "test"),
                List.of("input-id"),
                List.of(),
                null,
                ContentGeneration.Status.COMPLETED,
                null,
                Instant.now(),
                "parent",
                "parent-result");
        when(store.queryOutputs("owner", null, false, null, 11)).thenReturn(List.of(output));
        when(store.findGenerationsByIds("owner", null, false, List.of("generation")))
                .thenReturn(List.of(generation));
        ContentInput input = new ContentInput(
                "input-id", "generation", "owner", null, "image", 0, "input.png", null,
                "input.png", "image/png", "image", 100L, 10, 10, null, Instant.now(), null);
        when(store.hydrate(List.of(generation)))
                .thenReturn(List.of(new Hydrated(generation, List.of(input), List.of(output))));
        when(storage.publicUrl("output.png")).thenReturn("https://media.test/output.png");

        PagedResponse<MediaItemResponse> response = service.listMedia(owner, null, false, false, null, 10);

        assertThat(response.items()).singleElement().satisfies(item -> {
            assertThat(item.parentGenerationId()).isEqualTo("parent");
            assertThat(item.sourceCount()).isEqualTo(1);
        });
    }

    private static ContentGeneration generation(
            String id, String userId, String pageId, String parentGenerationId
    ) {
        return new ContentGeneration(
                id,
                userId,
                pageId,
                2,
                ContentGeneration.Provider.OPENAI,
                ContentGeneration.MediaType.IMAGE,
                null,
                Map.of("prompt", "test"),
                List.of(),
                List.of(),
                null,
                ContentGeneration.Status.COMPLETED,
                null,
                Instant.now(),
                parentGenerationId,
                parentGenerationId == null ? null : "parent-result");
    }
}
