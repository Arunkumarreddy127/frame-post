package com.example.framepost.library;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.example.framepost.auth.User;
import com.example.framepost.image.ImageGeneration;
import com.example.framepost.image.ImageGenerationRepository;
import com.example.framepost.page.PageService;
import com.example.framepost.runninghub.RunningHubGeneration;
import com.example.framepost.runninghub.RunningHubGenerationRepository;
import com.example.framepost.storage.StorageService;
import org.springframework.stereotype.Service;

@Service
public class LibraryService {

    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    private final ImageGenerationRepository imageRepository;
    private final RunningHubGenerationRepository runningHubRepository;
    private final PageService pageService;
    private final StorageService storage;

    public LibraryService(
            ImageGenerationRepository imageRepository,
            RunningHubGenerationRepository runningHubRepository,
            PageService pageService,
            StorageService storage
    ) {
        this.imageRepository = imageRepository;
        this.runningHubRepository = runningHubRepository;
        this.pageService = pageService;
        this.storage = storage;
    }

    /** Every input and output the user has stored, across all pages and global scope. */
    public LibraryResponse all(User user) {
        List<ImageGeneration> images = imageRepository.findByUserIdOrderByCreatedAtDesc(user.id());
        List<RunningHubGeneration> runningHub = runningHubRepository.findByUserIdOrderByCreatedAtDesc(user.id());
        return build(images, runningHub);
    }

    /** Inputs and outputs stored for one page only. */
    public LibraryResponse forPage(User user, String pageId) {
        pageService.get(user, pageId);
        List<ImageGeneration> images = imageRepository.findByUserIdAndPageIdOrderByCreatedAtDesc(user.id(), pageId);
        List<RunningHubGeneration> runningHub =
                runningHubRepository.findByUserIdAndPageIdOrderByCreatedAtDesc(user.id(), pageId);
        return build(images, runningHub);
    }

    private LibraryResponse build(List<ImageGeneration> images, List<RunningHubGeneration> runningHub) {
        List<LibraryItem> inputs = new ArrayList<>();
        List<LibraryItem> outputs = new ArrayList<>();

        for (ImageGeneration generation : images) {
            for (String key : generation.inputKeys()) {
                inputs.add(item(key, null, "image", generation.id(), generation.pageId(), generation.createdAt()));
            }
            for (ImageGeneration.ImageResult result : generation.results()) {
                if (result.key() != null) {
                    outputs.add(item(result.key(), null, "image", generation.id(), generation.pageId(),
                            generation.createdAt()));
                }
            }
        }

        for (RunningHubGeneration generation : runningHub) {
            for (String key : valuesOf(generation.inputFileKeys())) {
                inputs.add(item(key, null, "runninghub", generation.id(), generation.pageId(),
                        generation.createdAt()));
            }
            if (generation.resultKey() != null) {
                outputs.add(item(generation.resultKey(), generation.resultContentType(), "runninghub",
                        generation.id(), generation.pageId(), generation.createdAt()));
            }
        }

        return new LibraryResponse(sortNewestFirst(inputs), sortNewestFirst(outputs));
    }

    private LibraryItem item(
            String key,
            String contentType,
            String source,
            String generationId,
            String pageId,
            Instant createdAt
    ) {
        String type = contentType != null ? contentType : contentTypeFor(key);
        return new LibraryItem(key, storage.publicUrl(key), fileName(key), type, source, generationId, pageId,
                createdAt);
    }

    private static List<LibraryItem> sortNewestFirst(List<LibraryItem> items) {
        return items.stream()
                .sorted(Comparator.comparing(LibraryItem::createdAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    private static List<String> valuesOf(Map<String, String> map) {
        return map == null ? List.of() : map.values().stream().filter(value -> value != null).toList();
    }

    private static String fileName(String key) {
        return key.substring(key.lastIndexOf('/') + 1);
    }

    private static String contentTypeFor(String key) {
        String name = fileName(key).toLowerCase(Locale.ROOT);
        int dot = name.lastIndexOf('.');
        String extension = dot >= 0 ? name.substring(dot + 1) : "";
        return switch (extension) {
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            case "mp4" -> "video/mp4";
            case "webm" -> "video/webm";
            case "mov" -> "video/quicktime";
            default -> DEFAULT_CONTENT_TYPE;
        };
    }

    public record LibraryResponse(List<LibraryItem> inputs, List<LibraryItem> outputs) {
    }

    public record LibraryItem(
            String key,
            String url,
            String name,
            String contentType,
            String source,
            String generationId,
            String pageId,
            Instant createdAt
    ) {
    }
}
