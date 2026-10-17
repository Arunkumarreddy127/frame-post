package com.example.framepost.generation;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.config.R2Properties;
import com.example.framepost.generation.GenerationService.Catalog;
import com.example.framepost.generation.GenerationService.ImageRequest;
import com.example.framepost.storage.StorageKeys;

/**
 * The single API for generations of every provider. Each route also exists under
 * {@code /api/pages/{pageId}} to scope it to one page.
 */
@RestController
@RequestMapping("/api")
public class GenerationController {

    private static final String COOKIE_NAME = "framepost_session";
    private static final Logger log = LoggerFactory.getLogger(GenerationController.class);

    private final GenerationService service;
    private final GenerationEvents events;
    private final AuthService authService;
    private final S3Client s3Client;
    private final R2Properties r2Properties;

    public GenerationController(
            GenerationService service,
            GenerationEvents events,
            AuthService authService,
            S3Client s3Client,
            R2Properties r2Properties
    ) {
        this.service = service;
        this.events = events;
        this.authService = authService;
        this.s3Client = s3Client;
        this.r2Properties = r2Properties;
    }

    @GetMapping("/generations/catalog")
    public Catalog catalog(HttpServletRequest request) {
        currentUser(request);
        return service.catalog();
    }

    /**
     * Newest-first page of generations. {@code before} is the {@code nextCursor} of the previous page;
     * {@code globalOnly} limits the unscoped route to generations outside any page.
     */
    @GetMapping({"/generations", "/pages/{pageId}/generations"})
    public PagedResponse<GenerationResponse> list(
            @PathVariable(required = false) String pageId,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) String workflowKey,
            @RequestParam(required = false) String before,
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "false") boolean globalOnly,
            HttpServletRequest request
    ) {
        return service.list(currentUser(request), pageId, globalOnly, provider, workflowKey, before, limit);
    }

    /** Stored input or output files, newest first. */
    @GetMapping({"/generations/media/{kind}", "/pages/{pageId}/generations/media/{kind}"})
    public PagedResponse<MediaItemResponse> listMedia(
            @PathVariable(required = false) String pageId,
            @PathVariable String kind,
            @RequestParam(required = false) String before,
            @RequestParam(required = false) Integer limit,
            @RequestParam(defaultValue = "false") boolean globalOnly,
            HttpServletRequest request
    ) {
        if (!"inputs".equals(kind) && !"outputs".equals(kind)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown media kind");
        }
        return service.listMedia(currentUser(request), pageId, globalOnly, "inputs".equals(kind), before, limit);
    }

    @GetMapping({"/generations/{id}", "/pages/{pageId}/generations/{id}"})
    public GenerationResponse get(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        return service.get(currentUser(request), pageId, id);
    }

    /** Streams the generation now and again on every change until it is no longer processing. */
    @GetMapping(
            value = {"/generations/{id}/events", "/pages/{pageId}/generations/{id}/events"},
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        User user = currentUser(request);
        service.get(user, pageId, id);
        return events.subscribe(id, () -> service.get(user, pageId, id));
    }

    /**
     * Multipart form. {@code provider} selects the fields that follow: {@code openai} takes the prompt and
     * image settings, {@code runninghub} takes {@code workflowKey}, {@code instanceType} and one part per
     * workflow input. Workflows can only run inside a page.
     */
    @PostMapping(
            value = {"/generations", "/pages/{pageId}/generations"},
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<GenerationResponse> create(
            @PathVariable(required = false) String pageId,
            MultipartHttpServletRequest request
    ) {
        User user = currentUser(request);
        Map<String, String> fields = new LinkedHashMap<>();
        request.getParameterMap().forEach((name, values) -> {
            if (values.length > 0) {
                fields.put(name, values[0]);
            }
        });
        String provider = fields.remove("provider");
        if ("openai".equalsIgnoreCase(provider)) {
            GenerationResponse created = service.createImage(user, pageId, new ImageRequest(
                    fields.get("prompt"), fields.get("model"), fields.get("size"), fields.get("quality"),
                    count(fields.get("count")), request.getFiles("attachments"),
                    fields.get("parentGenerationId"), fields.get("parentResultKey")));
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        }
        if ("runninghub".equalsIgnoreCase(provider)) {
            String workflowKey = fields.remove("workflowKey");
            if (workflowKey == null || workflowKey.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "workflowKey is required");
            }
            String instanceType = fields.remove("instanceType");
            Map<String, MultipartFile> files = new HashMap<>(request.getFileMap());
            GenerationResponse started = service.startWorkflow(user, pageId, workflowKey, fields, files, instanceType);
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(started);
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "provider must be openai or runninghub");
    }

    @DeleteMapping({"/generations/{id}", "/pages/{pageId}/generations/{id}"})
    public ResponseEntity<Void> delete(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        service.delete(currentUser(request), pageId, id);
        return ResponseEntity.noContent().build();
    }

    /** Returns the stored object as an attachment. Only keys in the signed-in user's own folder are served. */
    @GetMapping({"/generations/download", "/images/download"})
    public ResponseEntity<byte[]> download(@RequestParam String key, HttpServletRequest request) {
        User user = currentUser(request);
        if (!StorageKeys.ownedBy(user, key)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        }
        try {
            byte[] bytes = s3Client.getObject(
                    GetObjectRequest.builder().bucket(r2Properties.bucketName()).key(key).build(),
                    ResponseTransformer.toBytes()).asByteArray();
            String name = MediaMetadata.fileName(key).replaceAll("[^A-Za-z0-9._-]", "_");
            return ResponseEntity.ok()
                    .header("Content-Type", MediaMetadata.contentTypeFor(key))
                    .header("Content-Disposition", "attachment; filename=\"" + name + "\"")
                    .body(bytes);
        } catch (S3Exception exception) {
            String errorCode = exception.awsErrorDetails() == null ? null : exception.awsErrorDetails().errorCode();
            if (exception.statusCode() == HttpStatus.NOT_FOUND.value() || "NoSuchKey".equals(errorCode)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
            }
            log.warn("R2 download failed with status {} and error code {}", exception.statusCode(), errorCode);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "File storage request failed");
        }
    }

    private static int count(String value) {
        if (value == null || value.isBlank()) {
            return 1;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "count must be a number");
        }
    }

    private User currentUser(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (COOKIE_NAME.equals(cookie.getName())) {
                    return authService.findBySession(cookie.getValue());
                }
            }
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }
}
