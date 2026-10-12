package com.example.framepost.image;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import com.example.framepost.auth.User;
import com.example.framepost.config.ImageProperties;
import com.example.framepost.page.PageService;
import com.example.framepost.storage.StorageService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

class ImageGenerationServiceTest {

    private final ImageGenerationRepository repository = mock(ImageGenerationRepository.class);
    private final PageService pageService = mock(PageService.class);
    private final OpenAiImageClient client = mock(OpenAiImageClient.class);
    private final StorageService storage = mock(StorageService.class);
    private final ImageGenerationService service = new ImageGenerationService(
            repository, pageService,
            new ImageProperties(List.of("gpt-image-2.5-sunburst", "gpt-image-2.5-flare"), 60),
            client, storage);
    private final User user = new User("user-1", "name", "hash", Instant.now());

    @Test
    void storesResultsInR2AndRecordsMetadata() {
        when(client.generate(any(), any())).thenReturn(List.of(new byte[] {1}, new byte[] {2}));
        doNothing().when(storage).store(any(), any(), anyLong(), eq("image/png"));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        var response = service.generate(user, null, " a cat ", "gpt-image-2.5-flare", "1024x1024", "xhigh", 2, null);

        ArgumentCaptor<ImageGeneration> saved = ArgumentCaptor.forClass(ImageGeneration.class);
        verify(repository).save(saved.capture());
        assertEquals("a cat", saved.getValue().prompt());
        assertEquals("xhigh", saved.getValue().quality());
        assertEquals(2, saved.getValue().results().size());
        assertEquals(ImageGenerationStatus.COMPLETED, saved.getValue().status());
        assertEquals("image-generations/user-1/" + response.id() + "/1.png", response.results().get(0).key());
    }

    @Test
    void tagsParentGenerationAndResult() {
        var parent = new ImageGeneration("p1", "user-1", null, "old", "gpt-image-2.5-flare", "auto", "auto", 1,
                "png", "auto", "auto", "none", List.of(), List.of(new ImageGeneration.ImageResult("k/1.png")),
                ImageGenerationStatus.COMPLETED, null, Instant.now(), null, null);
        when(repository.findByIdAndUserIdAndPageId("p1", "user-1", null)).thenReturn(java.util.Optional.of(parent));
        when(client.generate(any(), any())).thenReturn(List.of(new byte[] {1}));
        when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

        var response = service.generate(user, null, "new", "gpt-image-2.5-flare", "auto", "auto", 1, null,
                "p1", "k/1.png");

        assertEquals("p1", response.parentGenerationId());
        assertEquals("k/1.png", response.parentResultKey());
    }

    @Test
    void deletesGenerationAndItsStoredImages() {
        var generation = new ImageGeneration("g1", "user-1", null, "cat", "gpt-image-2.5-flare", "auto", "auto", 1,
                "png", "auto", "auto", "none", List.of("in/1.png"), List.of(new ImageGeneration.ImageResult("out/1.png")),
                ImageGenerationStatus.COMPLETED, null, Instant.now(), null, null);
        when(repository.findByIdAndUserIdAndPageId("g1", "user-1", null)).thenReturn(java.util.Optional.of(generation));

        service.delete(user, null, "g1");

        verify(repository).delete(generation);
        verify(storage).delete("out/1.png");
        verify(storage).delete("in/1.png");
    }

    @Test
    void deleteRejectsGenerationOwnedByAnotherUser() {
        when(repository.findByIdAndUserIdAndPageId("g1", "user-1", null)).thenReturn(java.util.Optional.empty());
        assertThrows(ResponseStatusException.class, () -> service.delete(user, null, "g1"));
        verifyNoInteractions(storage);
    }

    @Test
    void rejectsUnknownParent() {
        when(repository.findByIdAndUserIdAndPageId("p1", "user-1", null)).thenReturn(java.util.Optional.empty());
        assertThrows(ResponseStatusException.class, () -> service.generate(
                user, null, "x", "gpt-image-2.5-flare", "auto", "auto", 1, null, "p1", "k/1.png"));
        assertThrows(ResponseStatusException.class, () -> service.generate(
                user, null, "x", "gpt-image-2.5-flare", "auto", "auto", 1, null, "p1", null));
        verifyNoInteractions(client, storage);
    }

    @Test
    void rejectsInvalidInputBeforeCallingOpenAi() {
        assertThrows(ResponseStatusException.class,
                () -> service.generate(user, null, "x", "other-model", "auto", "auto", 1, null));
        assertThrows(ResponseStatusException.class,
                () -> service.generate(user, null, "x", "gpt-image-2.5-flare", "auto", "ultra", 1, null));
        assertThrows(ResponseStatusException.class,
                () -> service.generate(user, null, "x", "gpt-image-2.5-flare", "auto", "auto", 5, null));
        assertThrows(ResponseStatusException.class,
                () -> service.generate(user, null, " ", "gpt-image-2.5-flare", "auto", "auto", 1, null));
        verifyNoInteractions(client, storage, repository);
    }
}
