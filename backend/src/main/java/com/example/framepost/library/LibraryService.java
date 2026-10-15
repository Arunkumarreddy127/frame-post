package com.example.framepost.library;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.example.framepost.auth.User;
import com.example.framepost.generation.ContentGeneration;
import com.example.framepost.generation.ContentGenerationRepository;
import com.example.framepost.page.PageService;
import com.example.framepost.storage.StorageService;
import org.springframework.stereotype.Service;

@Service
public class LibraryService {

    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    private final ContentGenerationRepository repository;
    private final PageService pageService;
    private final StorageService storage;

    public LibraryService(
            ContentGenerationRepository repository,
            PageService pageService,
            StorageService storage
    ) {
        this.repository = repository;
        this.pageService = pageService;
        this.storage = storage;
    }

    /** Every input and output the user has stored, across all pages and global scope. */
    public LibraryResponse all(User user) {
        return build(repository.findByUserIdOrderByCreatedAtDesc(user.id()));
    }

    /** Inputs and outputs stored for one page only. */
    public LibraryResponse forPage(User user, String pageId) {
        pageService.get(user, pageId);
        return build(repository.findByUserIdAndPageIdOrderByCreatedAtDesc(user.id(), pageId));
    }

    private LibraryResponse build(List<ContentGeneration> generations) {
        List<LibraryItem> inputs = new ArrayList<>();
        List<LibraryItem> outputs = new ArrayList<>();

        for (ContentGeneration generation : generations) {
            String source = generation.provider() == ContentGeneration.Provider.OPENAI ? "image" : "runninghub";
            for (String key : valuesOf(generation.inputFileKeys())) {
                inputs.add(item(key, null, source, generation.id(), generation.pageId(),
                        generation.createdAt()));
            }
            for (ContentGeneration.Output output : generation.outputs()) {
                if (output.key() != null) {
                    outputs.add(item(output.key(), output.contentType(), source,
                            generation.id(), generation.pageId(), generation.createdAt()));
                }
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
