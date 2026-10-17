package com.example.framepost.image;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

import com.example.framepost.auth.User;
import com.example.framepost.config.ImageProperties;
import com.example.framepost.generation.MediaMetadata;
import com.example.framepost.image.ImageGeneration.ImageResult;
import com.example.framepost.image.OpenAiImageClient.ImageRequest;
import com.example.framepost.image.OpenAiImageClient.ImageRequestException;
import com.example.framepost.image.OpenAiImageClient.InputImage;
import com.example.framepost.page.PageService;
import com.example.framepost.storage.StorageKeys;
import com.example.framepost.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ImageGenerationService {

    static final int MAX_IMAGES = 4;
    static final int MAX_ATTACHMENTS = 4;
    static final int MAX_PROMPT_LENGTH = 32000;
    static final long MAX_ATTACHMENT_BYTES = 20L * 1024 * 1024;

    private static final Set<String> SIZES = Set.of("auto", "1024x1024", "1024x1536", "1536x1024");
    private static final Set<String> QUALITIES = Set.of("auto", "low", "medium", "high", "xhigh", "max");
    private static final Map<String, String> ATTACHMENT_TYPES = Map.of(
            "image/png", "png", "image/jpeg", "jpg", "image/webp", "webp");
    private static final String OUTPUT_FORMAT = "png";
    private static final String BACKGROUND = "auto";
    private static final String MODERATION = "auto";
    private static final String PARTIAL_IMAGES = "none";

    private static final Logger log = LoggerFactory.getLogger(ImageGenerationService.class);

    private final ImageGenerationRepository repository;
    private final PageService pageService;
    private final ImageProperties properties;
    private final OpenAiImageClient client;
    private final StorageService storage;

    public ImageGenerationService(
            ImageGenerationRepository repository,
            PageService pageService,
            ImageProperties properties,
            OpenAiImageClient client,
            StorageService storage
    ) {
        this.repository = repository;
        this.pageService = pageService;
        this.properties = properties;
        this.client = client;
        this.storage = storage;
    }

    public List<String> availableModels() {
        return properties.allowedModels();
    }

    public List<ImageGenerationResponse> list(User user, String pageId) {
        validateScope(user, pageId);
        return repository.findByUserIdAndPageIdOrderByCreatedAtDesc(user.id(), pageId).stream()
                .map(generation -> ImageGenerationResponse.from(generation, storage::publicUrl))
                .toList();
    }

    public ImageGenerationResponse get(User user, String pageId, String id) {
        validateScope(user, pageId);
        return repository.findByIdAndUserIdAndPageId(id, user.id(), pageId)
                .map(generation -> ImageGenerationResponse.from(generation, storage::publicUrl))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Generation not found"));
    }

    public ImageGenerationResponse generate(
            User user,
            String pageId,
            String prompt,
            String model,
            String size,
            String quality,
            int count,
            List<MultipartFile> attachments
    ) {
        return generate(user, pageId, prompt, model, size, quality, count, attachments, null, null);
    }

    public ImageGenerationResponse generate(
            User user,
            String pageId,
            String prompt,
            String model,
            String size,
            String quality,
            int count,
            List<MultipartFile> attachments,
            String parentGenerationId,
            String parentResultKey
    ) {
        validateScope(user, pageId);
        validateParent(user, pageId, parentGenerationId, parentResultKey);
        String cleanPrompt = prompt == null ? "" : prompt.trim();
        if (cleanPrompt.isEmpty() || cleanPrompt.length() > MAX_PROMPT_LENGTH) {
            throw badRequest("Enter a prompt of up to " + MAX_PROMPT_LENGTH + " characters");
        }
        if (model == null || !properties.allowedModels().contains(model)) {
            throw badRequest("The selected model is not available");
        }
        if (size == null || !SIZES.contains(size)) {
            throw badRequest("The selected size is not available");
        }
        if (quality == null || !QUALITIES.contains(quality)) {
            throw badRequest("The selected quality is not available");
        }
        if (count < 1 || count > MAX_IMAGES) {
            throw badRequest("Number of images must be between 1 and " + MAX_IMAGES);
        }
        List<MultipartFile> files = attachments == null
                ? List.of()
                : attachments.stream().filter(file -> !file.isEmpty()).toList();
        if (files.size() > MAX_ATTACHMENTS) {
            throw badRequest("Attach up to " + MAX_ATTACHMENTS + " images");
        }
        List<InputImage> inputs = readAttachments(files);

        String id = UUID.randomUUID().toString();
        String inputPrefix = StorageKeys.inputPrefix(user, id);
        String outputPrefix = StorageKeys.outputPrefix(user, id);
        Set<String> inputNames = new HashSet<>();
        List<String> storedKeys = new ArrayList<>();
        List<String> inputKeys = new ArrayList<>();
        List<ImageResult> results = new ArrayList<>();
        Map<String, MediaMetadata> metadata = new LinkedHashMap<>();
        Instant now = Instant.now();
        try {
            List<byte[]> generated = client.generate(new ImageRequest(
                    model, cleanPrompt, count, size, "auto".equals(quality) ? null : quality,
                    OUTPUT_FORMAT, BACKGROUND, MODERATION), inputs);
            for (int index = 0; index < inputs.size(); index++) {
                InputImage input = inputs.get(index);
                String name = StorageKeys.fileName(files.get(index).getOriginalFilename(),
                        ATTACHMENT_TYPES.get(input.contentType()), "input-" + (index + 1), inputNames);
                String key = inputPrefix + name;
                store(key, input.bytes(), input.contentType());
                storedKeys.add(key);
                inputKeys.add(key);
                metadata.put(key, MediaMetadata.of(input.bytes(), input.contentType()));
            }
            for (int index = 0; index < generated.size(); index++) {
                String key = outputPrefix + "output-" + (index + 1) + "." + OUTPUT_FORMAT;
                store(key, generated.get(index), "image/" + OUTPUT_FORMAT);
                storedKeys.add(key);
                results.add(new ImageResult(key));
                metadata.put(key, MediaMetadata.of(generated.get(index), "image/" + OUTPUT_FORMAT));
            }
        } catch (ImageRequestException exception) {
            log.warn("OpenAI image generation failed for model {}", model, exception);
            repository.save(record(id, user, pageId, cleanPrompt, model, size, quality, count,
                    inputKeys, List.of(), ImageGenerationStatus.FAILED, exception.getMessage(), now,
                    parentGenerationId, parentResultKey, Map.of()));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, exception.getMessage());
        } catch (RuntimeException exception) {
            storedKeys.forEach(this::deleteQuietly);
            if (exception instanceof ResponseStatusException) {
                throw exception;
            }
            log.error("Storing generated images failed for generation {}", id, exception);
            repository.save(record(id, user, pageId, cleanPrompt, model, size, quality, count,
                    List.of(), List.of(), ImageGenerationStatus.FAILED, "Unable to store the generated images", now,
                    parentGenerationId, parentResultKey, Map.of()));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to store the generated images");
        }
        ImageGeneration saved = repository.save(record(id, user, pageId, cleanPrompt, model, size, quality, count,
                inputKeys, results, ImageGenerationStatus.COMPLETED, null, now,
                parentGenerationId, parentResultKey, metadata));
        return ImageGenerationResponse.from(saved, storage::publicUrl);
    }

    public void delete(User user, String pageId, String id) {
        validateScope(user, pageId);
        ImageGeneration generation = repository.findByIdAndUserIdAndPageId(id, user.id(), pageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Generation not found"));
        repository.delete(generation);
        generation.results().forEach(result -> deleteQuietly(result.key()));
        generation.inputKeys().forEach(this::deleteQuietly);
    }

    private ImageGeneration record(
            String id, User user, String pageId, String prompt, String model, String size, String quality,
            int count, List<String> inputKeys, List<ImageResult> results,
            ImageGenerationStatus status, String error, Instant createdAt,
            String parentGenerationId, String parentResultKey, Map<String, MediaMetadata> metadata
    ) {
        return new ImageGeneration(id, user.id(), pageId, prompt, model, size, quality, count,
                OUTPUT_FORMAT, BACKGROUND, MODERATION, PARTIAL_IMAGES, inputKeys, results, status, error, createdAt,
                parentGenerationId, parentResultKey, metadata);
    }

    private List<InputImage> readAttachments(List<MultipartFile> files) {
        List<InputImage> inputs = new ArrayList<>();
        for (MultipartFile file : files) {
            String type = file.getContentType();
            if (type == null || !ATTACHMENT_TYPES.containsKey(type)) {
                throw badRequest("Attachments must be PNG, JPEG, or WebP images");
            }
            if (file.getSize() > MAX_ATTACHMENT_BYTES) {
                throw badRequest("Each attachment must be 20 MB or smaller");
            }
            try {
                inputs.add(new InputImage(
                        "image-" + (inputs.size() + 1) + "." + ATTACHMENT_TYPES.get(type), type, file.getBytes()));
            } catch (IOException exception) {
                throw badRequest("Unable to read an attachment");
            }
        }
        return inputs;
    }

    private void store(String key, byte[] bytes, String contentType) {
        storage.store(key, new ByteArrayInputStream(bytes), bytes.length, contentType);
    }

    private void deleteQuietly(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException ignored) {
            // best-effort cleanup
        }
    }

    private void validateParent(User user, String pageId, String parentId, String parentKey) {
        if (parentId == null && parentKey == null) {
            return;
        }
        if (parentId == null || parentKey == null) {
            throw badRequest("Parent generation and result are both required");
        }
        ImageGeneration parent = repository.findByIdAndUserIdAndPageId(parentId, user.id(), pageId)
                .orElseThrow(() -> badRequest("Parent generation not found"));
        if (parent.results().stream().noneMatch(result -> result.key().equals(parentKey))) {
            throw badRequest("Parent result not found");
        }
    }

    private void validateScope(User user, String pageId) {
        if (pageId != null) {
            pageService.get(user, pageId);
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public record ImageGenerationResponse(
            String id,
            String pageId,
            String prompt,
            String model,
            String size,
            String quality,
            int imageCount,
            String outputFormat,
            String background,
            String moderation,
            String partialImages,
            List<String> inputKeys,
            List<ImageResultResponse> inputs,
            List<ImageResultResponse> results,
            ImageGenerationStatus status,
            String error,
            Instant createdAt,
            String parentGenerationId,
            String parentResultKey
    ) {
        static ImageGenerationResponse from(ImageGeneration g, Function<String, String> publicUrl) {
            List<ImageResultResponse> results = g.results().stream()
                    .map(result -> new ImageResultResponse(result.key(), publicUrl.apply(result.key())))
                    .toList();
            List<ImageResultResponse> inputs = g.inputKeys().stream()
                    .map(key -> new ImageResultResponse(key, publicUrl.apply(key)))
                    .toList();
            return new ImageGenerationResponse(g.id(), g.pageId(), g.prompt(), g.model(), g.size(), g.quality(),
                    g.imageCount(), g.outputFormat(), g.background(), g.moderation(), g.partialImages(),
                    g.inputKeys(), inputs, results, g.status(), g.error(), g.createdAt(),
                    g.parentGenerationId(), g.parentResultKey());
        }
    }

    public record ImageResultResponse(String key, String url) {
    }
}
