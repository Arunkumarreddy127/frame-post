package com.example.framepost.creation;

import java.util.List;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.creation.CreationService.AddItemRequest;
import com.example.framepost.creation.CreationService.CreationItemResponse;
import com.example.framepost.creation.CreationService.CreationRequest;
import com.example.framepost.creation.CreationService.CreationResponse;
import com.example.framepost.creation.CreationService.ReorderRequest;

/**
 * Creations API. Each route also exists under {@code /api/pages/{pageId}} to scope it to one page.
 */
@RestController
@RequestMapping("/api")
public class CreationController {

    private static final String COOKIE_NAME = "framepost_session";

    private final CreationService service;
    private final AuthService authService;

    public CreationController(CreationService service, AuthService authService) {
        this.service = service;
        this.authService = authService;
    }

    @GetMapping({"/creations", "/pages/{pageId}/creations"})
    public List<CreationResponse> list(
            @PathVariable(required = false) String pageId,
            HttpServletRequest request
    ) {
        return service.list(currentUser(request), pageId);
    }

    @PostMapping({"/creations", "/pages/{pageId}/creations"})
    public ResponseEntity<CreationResponse> create(
            @PathVariable(required = false) String pageId,
            @RequestBody CreationRequest body,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(currentUser(request), pageId, body));
    }

    @GetMapping({"/creations/grouped", "/pages/{pageId}/creations/grouped"})
    public List<String> grouped(
            @PathVariable(required = false) String pageId,
            @RequestParam List<String> generationIds,
            HttpServletRequest request
    ) {
        return service.groupedGenerationIds(currentUser(request), pageId, generationIds);
    }

    @GetMapping({"/creations/{id}", "/pages/{pageId}/creations/{id}"})
    public CreationResponse get(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        return service.get(currentUser(request), pageId, id);
    }

    @PutMapping({"/creations/{id}", "/pages/{pageId}/creations/{id}"})
    public CreationResponse update(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @RequestBody CreationRequest body,
            HttpServletRequest request
    ) {
        return service.update(currentUser(request), pageId, id, body);
    }

    @DeleteMapping({"/creations/{id}", "/pages/{pageId}/creations/{id}"})
    public ResponseEntity<Void> delete(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        service.delete(currentUser(request), pageId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping({"/creations/{id}/items", "/pages/{pageId}/creations/{id}/items"})
    public List<CreationItemResponse> listItems(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        return service.listItems(currentUser(request), pageId, id);
    }

    @PostMapping({"/creations/{id}/items", "/pages/{pageId}/creations/{id}/items"})
    public ResponseEntity<CreationItemResponse> addItem(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @RequestBody AddItemRequest body,
            HttpServletRequest request
    ) {
        CreationItemResponse added = service.addItem(currentUser(request), pageId, id, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(added);
    }

    @DeleteMapping({"/creations/{id}/items/{itemId}", "/pages/{pageId}/creations/{id}/items/{itemId}"})
    public ResponseEntity<Void> removeItem(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @PathVariable String itemId,
            HttpServletRequest request
    ) {
        service.removeItem(currentUser(request), pageId, id, itemId);
        return ResponseEntity.noContent().build();
    }

    /** Sets the full order. The body must list every current item id exactly once. */
    @PutMapping({"/creations/{id}/items/order", "/pages/{pageId}/creations/{id}/items/order"})
    public List<CreationItemResponse> reorder(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @RequestBody ReorderRequest body,
            HttpServletRequest request
    ) {
        return service.reorder(currentUser(request), pageId, id, body);
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
