package com.example.framepost.image;

import java.util.List;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.image.ImageGenerationService.ImageGenerationResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ImageGenerationController {

    private static final String COOKIE_NAME = "framepost_session";

    private final ImageGenerationService service;
    private final AuthService authService;

    public ImageGenerationController(ImageGenerationService service, AuthService authService) {
        this.service = service;
        this.authService = authService;
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
            HttpServletRequest request
    ) {
        return service.generate(currentUser(request), null, prompt, model, size, quality, count, attachments);
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
            HttpServletRequest request
    ) {
        return service.generate(currentUser(request), pageId, prompt, model, size, quality, count, attachments);
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
