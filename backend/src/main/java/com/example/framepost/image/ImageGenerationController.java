package com.example.framepost.image;

import java.util.List;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.image.ImageGenerationService.ImageGenerationResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import com.example.framepost.config.R2Properties;

@RestController
@RequestMapping("/api")
public class ImageGenerationController {

    private static final String COOKIE_NAME = "framepost_session";

    private final ImageGenerationService service;
    private final AuthService authService;
    private final S3Client s3Client;
    private final R2Properties r2Properties;

    public ImageGenerationController(ImageGenerationService service, AuthService authService, S3Client s3Client, R2Properties r2Properties) {
        this.service = service;
        this.authService = authService;
        this.s3Client = s3Client;
        this.r2Properties = r2Properties;
    }

    @GetMapping("/images/models")
    public List<String> models(HttpServletRequest request) {
        currentUser(request);
        return service.availableModels();
    }

    @GetMapping("/images")
    public List<ImageGenerationResponse> list(HttpServletRequest request) {
        return service.list(currentUser(request), null);
    }

    @GetMapping("/pages/{pageId}/images")
    public List<ImageGenerationResponse> listForPage(@PathVariable String pageId, HttpServletRequest request) {
        return service.list(currentUser(request), pageId);
    }

    @GetMapping("/images/{id}")
    public ImageGenerationResponse get(@PathVariable String id, HttpServletRequest request) {
        return service.get(currentUser(request), null, id);
    }

    @GetMapping("/pages/{pageId}/images/{id}")
    public ImageGenerationResponse getForPage(
            @PathVariable String pageId,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        return service.get(currentUser(request), pageId, id);
    }

    @PostMapping(value = "/images/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ImageGenerationResponse generate(
            @RequestParam String prompt,
            @RequestParam String model,
            @RequestParam String size,
            @RequestParam String quality,
            @RequestParam(defaultValue = "1") int count,
            @RequestParam(name = "attachments", required = false) List<MultipartFile> attachments,
            @RequestParam(required = false) String parentGenerationId,
            @RequestParam(required = false) String parentResultKey,
            HttpServletRequest request
    ) {
        return service.generate(currentUser(request), null, prompt, model, size, quality, count, attachments,
                parentGenerationId, parentResultKey);
    }

    @PostMapping(value = "/pages/{pageId}/images/generate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ImageGenerationResponse generateForPage(
            @PathVariable String pageId,
            @RequestParam String prompt,
            @RequestParam String model,
            @RequestParam String size,
            @RequestParam String quality,
            @RequestParam(defaultValue = "1") int count,
            @RequestParam(name = "attachments", required = false) List<MultipartFile> attachments,
            @RequestParam(required = false) String parentGenerationId,
            @RequestParam(required = false) String parentResultKey,
            HttpServletRequest request
    ) {
        return service.generate(currentUser(request), pageId, prompt, model, size, quality, count, attachments,
                parentGenerationId, parentResultKey);
    }

    @DeleteMapping("/images/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, HttpServletRequest request) {
        service.delete(currentUser(request), null, id);
    }

    @DeleteMapping("/pages/{pageId}/images/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteForPage(
            @PathVariable String pageId,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        service.delete(currentUser(request), pageId, id);
    }

    @GetMapping("/images/download/**")
    public ResponseEntity<byte[]> downloadImage(HttpServletRequest request, @RequestParam(required = false) String key) {
        currentUser(request);
        
        String storageKey = extractStorageKey(request, key);
        if (storageKey == null || storageKey.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Storage key is required");
        }

        try {
            var responseBytes = s3Client.getObject(
                    GetObjectRequest.builder()
                            .bucket(r2Properties.bucketName())
                            .key(storageKey)
                            .build(),
                    ResponseTransformer.toBytes()
            );
            byte[] imageData = responseBytes.asByteArray();

            String contentType = determineContentType(storageKey);
            return ResponseEntity.ok()
                    .header("Content-Type", contentType)
                    .header("Content-Disposition", "attachment; filename=\"image." + getFileExtension(storageKey) + "\"")
                    .body(imageData);
        } catch (S3Exception e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Image not found");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to download image");
        }
    }

    private String extractStorageKey(HttpServletRequest request, String keyParam) {
        if (keyParam != null && !keyParam.isEmpty()) {
            return keyParam;
        }
        String uri = request.getRequestURI();
        String prefix = "/api/images/download/";
        int index = uri.indexOf(prefix);
        if (index >= 0) {
            return uri.substring(index + prefix.length());
        }
        return null;
    }

    private String determineContentType(String storageKey) {
        if (storageKey.endsWith(".png")) return "image/png";
        if (storageKey.endsWith(".jpg") || storageKey.endsWith(".jpeg")) return "image/jpeg";
        if (storageKey.endsWith(".gif")) return "image/gif";
        if (storageKey.endsWith(".webp")) return "image/webp";
        return "image/png";
    }

    private String getFileExtension(String storageKey) {
        int lastDot = storageKey.lastIndexOf('.');
        if (lastDot > 0) {
            return storageKey.substring(lastDot + 1);
        }
        return "png";
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
