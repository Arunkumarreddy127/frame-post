package com.example.framepost.generation;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.User;
import com.example.framepost.generation.ContentGenerationStore.Cursor;
import com.example.framepost.generation.ContentGenerationStore.Hydrated;
import com.example.framepost.image.ImageGenerationService;
import com.example.framepost.page.PageService;
import com.example.framepost.runninghub.RunningHubGenerationService;
import com.example.framepost.runninghub.RunningHubGenerationService.WorkflowView;
import com.example.framepost.storage.StorageService;

/**
 * One entry point for listing, reading, creating and deleting generations of every provider.
 * Provider-specific validation and execution stay in {@link ImageGenerationService} and
 * {@link RunningHubGenerationService}.
 */
@Service
public class GenerationService {

    static final int DEFAULT_LIMIT = 10;
    static final int MAX_LIMIT = 50;

    private final ContentGenerationStore store;
    private final PageService pageService;
    private final StorageService storage;
    private final ImageGenerationService imageService;
    private final RunningHubGenerationService runningHubService;

    public GenerationService(
            ContentGenerationStore store,
            PageService pageService,
            StorageService storage,
            ImageGenerationService imageService,
            RunningHubGenerationService runningHubService
    ) {
        this.store = store;
        this.pageService = pageService;
        this.storage = storage;
        this.imageService = imageService;
        this.runningHubService = runningHubService;
    }

    public record Catalog(List<String> imageModels, List<WorkflowView> runningHubWorkflows) {
    }

    public record ImageRequest(
            String prompt, String model, String size, String quality, int count,
            List<MultipartFile> attachments, String parentGenerationId, String parentResultKey
    ) {
    }

    public Catalog catalog() {
        return new Catalog(imageService.availableModels(), runningHubService.workflows());
    }

    /**
     * Newest-first page of generations. A null {@code pageId} lists every scope the user owns, unless
     * {@code globalOnly} limits it to generations outside any page.
     */
    public PagedResponse<GenerationResponse> list(
            User user, String pageId, boolean globalOnly, String provider, String workflowKey, String before,
            Integer limit
    ) {
        validateScope(user, pageId);
        int size = pageSize(limit);
        List<ContentGeneration> rows = store.queryGenerations(
                user.id(), pageId, globalOnly, parseProvider(provider), workflowKey, parseCursor(before), size + 1);
        boolean more = rows.size() > size;
        List<ContentGeneration> pageRows = more ? rows.subList(0, size) : rows;
        List<GenerationResponse> items = store.hydrate(pageRows).stream().map(this::toResponse).toList();
        String next = more ? new Cursor(pageRows.getLast().createdAt(), pageRows.getLast().id()).encode() : null;
        return new PagedResponse<>(items, next);
    }

    public GenerationResponse get(User user, String pageId, String id) {
        return toResponse(load(user, pageId, id));
    }

    public void delete(User user, String pageId, String id) {
        Hydrated hydrated = load(user, pageId, id);
        store.delete(id);
        hydrated.inputs().forEach(file -> deleteQuietly(file.key()));
        hydrated.outputs().forEach(file -> deleteQuietly(file.key()));
    }

    public GenerationResponse createImage(User user, String pageId, ImageRequest request) {
        String id = imageService.generate(user, pageId, request.prompt(), request.model(), request.size(),
                request.quality(), request.count(), request.attachments(), request.parentGenerationId(),
                request.parentResultKey()).id();
        return get(user, pageId, id);
    }

    public GenerationResponse startWorkflow(
            User user, String pageId, String workflowKey, Map<String, String> textValues,
            Map<String, MultipartFile> files, String instanceType
    ) {
        if (pageId == null) {
            throw badRequest("Workflows run inside a page");
        }
        String id = runningHubService.start(user, pageId, workflowKey, textValues, files, instanceType).id();
        return get(user, pageId, id);
    }

    /** Newest-first page of stored input or output files. */
    public PagedResponse<MediaItemResponse> listMedia(
            User user, String pageId, boolean globalOnly, boolean inputs, String before, Integer limit
    ) {
        validateScope(user, pageId);
        int size = pageSize(limit);
        Cursor cursor = parseCursor(before);
        if (inputs) {
            List<ContentInput> rows = store.queryInputs(user.id(), pageId, globalOnly, cursor, size + 1);
            List<ContentInput> pageRows = rows.size() > size ? rows.subList(0, size) : rows;
            return new PagedResponse<>(pageRows.stream().map(this::toItem).toList(),
                    rows.size() > size ? new Cursor(pageRows.getLast().createdAt(), pageRows.getLast().id()).encode() : null);
        }
        List<ContentOutput> rows = store.queryOutputs(user.id(), pageId, globalOnly, cursor, size + 1);
        List<ContentOutput> pageRows = rows.size() > size ? rows.subList(0, size) : rows;
        return new PagedResponse<>(pageRows.stream().map(this::toItem).toList(),
                rows.size() > size ? new Cursor(pageRows.getLast().createdAt(), pageRows.getLast().id()).encode() : null);
    }

    private Hydrated load(User user, String pageId, String id) {
        validateScope(user, pageId);
        return store.find(id)
                .filter(hydrated -> hydrated.generation().userId().equals(user.id()))
                .filter(hydrated -> pageId == null || pageId.equals(hydrated.generation().pageId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Generation not found"));
    }

    private GenerationResponse toResponse(Hydrated hydrated) {
        ContentGeneration generation = hydrated.generation();
        return new GenerationResponse(
                generation.id(), generation.pageId(), generation.provider(), generation.generationType(),
                generation.workflowKey(), generation.inputs(), generation.status(), generation.error(),
                generation.createdAt(), generation.parentGenerationId(), generation.parentResultKey(),
                hydrated.inputs().stream().map(this::toItem).toList(),
                hydrated.outputs().stream().map(this::toItem).toList());
    }

    private MediaItemResponse toItem(ContentInput file) {
        return new MediaItemResponse(file.id(), file.generationId(), file.pageId(), file.slot(), null,
                file.position(), file.key(), storage.publicUrl(file.key()), file.name(), file.contentType(),
                file.mediaType(), file.sizeBytes(), file.width(), file.height(), file.durationSeconds(),
                file.createdAt());
    }

    private MediaItemResponse toItem(ContentOutput file) {
        return new MediaItemResponse(file.id(), file.generationId(), file.pageId(), null, file.type(),
                file.position(), file.key(), storage.publicUrl(file.key()), file.name(), file.contentType(),
                file.mediaType(), file.sizeBytes(), file.width(), file.height(), file.durationSeconds(),
                file.createdAt());
    }

    private void validateScope(User user, String pageId) {
        if (pageId != null) {
            pageService.get(user, pageId);
        }
    }

    private void deleteQuietly(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException ignored) {
            // The record is already gone; a leftover object is harmless.
        }
    }

    private static int pageSize(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        if (limit < 1 || limit > MAX_LIMIT) {
            throw badRequest("Limit must be between 1 and " + MAX_LIMIT);
        }
        return limit;
    }

    private static Cursor parseCursor(String before) {
        try {
            return Cursor.parse(before);
        } catch (IllegalArgumentException exception) {
            throw badRequest("Invalid cursor");
        }
    }

    private static ContentGeneration.Provider parseProvider(String provider) {
        if (provider == null || provider.isBlank()) {
            return null;
        }
        try {
            return ContentGeneration.Provider.valueOf(provider.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw badRequest("Unknown provider: " + provider);
        }
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
