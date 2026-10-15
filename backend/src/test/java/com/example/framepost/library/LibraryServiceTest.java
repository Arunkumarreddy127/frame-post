package com.example.framepost.library;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.example.framepost.auth.User;
import com.example.framepost.image.ImageGeneration;
import com.example.framepost.generation.ContentGeneration;
import com.example.framepost.generation.ContentGenerationRepository;
import com.example.framepost.image.ImageGenerationStatus;
import com.example.framepost.library.LibraryService.LibraryResponse;
import com.example.framepost.page.PageService;
import com.example.framepost.runninghub.RunningHubGeneration;
import com.example.framepost.runninghub.RunningHubGenerationStatus;
import com.example.framepost.storage.StorageService;
import org.junit.jupiter.api.Test;

class LibraryServiceTest {

    private final ContentGenerationRepository repository = mock(ContentGenerationRepository.class);
    private final PageService pageService = mock(PageService.class);
    private final StorageService storage = mock(StorageService.class);
    private final LibraryService service = new LibraryService(repository, pageService, storage);
    private final User user = new User("u1", "jane", "hash", Instant.now());

    @Test
    void allCollectsInputsAndOutputsAcrossPagesAndGlobal() {
        Instant now = Instant.now();
        when(storage.publicUrl(any())).thenAnswer(i -> "https://cdn.example/" + i.getArgument(0));
        when(repository.findByUserIdOrderByCreatedAtDesc("u1")).thenReturn(List.of(
            ContentGeneration.fromImage(imageGeneration(now)),
            ContentGeneration.fromRunningHub(runningHubGeneration(now), "video")));

        LibraryResponse response = service.all(user);

        assertEquals(List.of("inputs/jane-u1/g1/ref-1.png", "inputs/jane-u1/g2/frame.png"),
                response.inputs().stream().map(LibraryService.LibraryItem::key).toList());
        assertEquals(List.of("outputs/jane-u1/g1/output-1.png", "outputs/jane-u1/g2/minimax-output.mp4"),
                response.outputs().stream().map(LibraryService.LibraryItem::key).toList());
        LibraryService.LibraryItem video = response.outputs().get(1);
        assertEquals("minimax-output.mp4", video.name());
        assertEquals("video/mp4", video.contentType());
        assertEquals("runninghub", video.source());
        assertEquals("https://cdn.example/outputs/jane-u1/g2/minimax-output.mp4", video.url());
    }

    @Test
    void forPageOnlyReadsThatPage() {
        when(repository.findByUserIdAndPageIdOrderByCreatedAtDesc("u1", "p1")).thenReturn(List.of());

        LibraryResponse response = service.forPage(user, "p1");

        verify(pageService).get(user, "p1");
        verify(repository).findByUserIdAndPageIdOrderByCreatedAtDesc("u1", "p1");
        assertEquals(List.of(), response.inputs());
        assertEquals(List.of(), response.outputs());
    }

    private ImageGeneration imageGeneration(Instant createdAt) {
        return new ImageGeneration("g1", "u1", null, "prompt", "model", "1024x1024", "high", 1, "png", null, null,
                null, List.of("inputs/jane-u1/g1/ref-1.png"),
                List.of(new ImageGeneration.ImageResult("outputs/jane-u1/g1/output-1.png")),
                ImageGenerationStatus.COMPLETED, null, createdAt, null, null);
    }

    private RunningHubGeneration runningHubGeneration(Instant createdAt) {
        return new RunningHubGeneration("g2", "u1", "p1", "minimax", Map.of(),
                Map.of("image", "inputs/jane-u1/g2/frame.png"),
                "outputs/jane-u1/g2/minimax-output.mp4", "video", "video/mp4", "task-2",
                RunningHubGenerationStatus.COMPLETED, null, "default", createdAt);
    }
}
