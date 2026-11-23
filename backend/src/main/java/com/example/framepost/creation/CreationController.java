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
import com.example.framepost.creation.ProductionService.FinalFrameRequest;
import com.example.framepost.creation.ProductionService.MoveItemRequest;
import com.example.framepost.creation.ProductionService.OutlineResponse;
import com.example.framepost.creation.ProductionService.SceneOrderRequest;
import com.example.framepost.creation.ProductionService.SceneRequest;
import com.example.framepost.creation.ProductionService.SceneResponse;
import com.example.framepost.creation.ProductionService.ShotOrderRequest;
import com.example.framepost.creation.ProductionService.ShotRequest;
import com.example.framepost.creation.ProductionService.ShotResponse;

/**
 * Creations API. Each route also exists under {@code /api/pages/{pageId}} to scope it to one page.
 */
@RestController
@RequestMapping("/api")
public class CreationController {

    private static final String COOKIE_NAME = "framepost_session";

    private final CreationService service;
    private final ProductionService production;
    private final AuthService authService;

    public CreationController(CreationService service, ProductionService production, AuthService authService) {
        this.service = service;
        this.production = production;
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

    @GetMapping({"/creations/{id}/outline", "/pages/{pageId}/creations/{id}/outline"})
    public OutlineResponse outline(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        return production.outline(currentUser(request), pageId, id);
    }

    @PostMapping({"/creations/{id}/scenes", "/pages/{pageId}/creations/{id}/scenes"})
    public ResponseEntity<SceneResponse> createScene(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @RequestBody SceneRequest body,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(production.createScene(currentUser(request), pageId, id, body));
    }

    @PutMapping({"/creations/{id}/scenes/order", "/pages/{pageId}/creations/{id}/scenes/order"})
    public OutlineResponse reorderScenes(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @RequestBody SceneOrderRequest body,
            HttpServletRequest request
    ) {
        return production.reorderScenes(currentUser(request), pageId, id, body);
    }

    @PutMapping({"/creations/{id}/scenes/{sceneId}", "/pages/{pageId}/creations/{id}/scenes/{sceneId}"})
    public SceneResponse updateScene(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @PathVariable String sceneId,
            @RequestBody SceneRequest body,
            HttpServletRequest request
    ) {
        return production.updateScene(currentUser(request), pageId, id, sceneId, body);
    }

    @DeleteMapping({"/creations/{id}/scenes/{sceneId}", "/pages/{pageId}/creations/{id}/scenes/{sceneId}"})
    public ResponseEntity<Void> deleteScene(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @PathVariable String sceneId,
            HttpServletRequest request
    ) {
        production.deleteScene(currentUser(request), pageId, id, sceneId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping({"/creations/{id}/shots", "/pages/{pageId}/creations/{id}/shots"})
    public ResponseEntity<ShotResponse> createShot(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @RequestBody ShotRequest body,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(production.createShot(currentUser(request), pageId, id, body));
    }

    @PutMapping({"/creations/{id}/shots/order", "/pages/{pageId}/creations/{id}/shots/order"})
    public OutlineResponse reorderShots(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @RequestBody ShotOrderRequest body,
            HttpServletRequest request
    ) {
        return production.reorderShots(currentUser(request), pageId, id, body);
    }

    @PutMapping({"/creations/{id}/shots/{shotId}", "/pages/{pageId}/creations/{id}/shots/{shotId}"})
    public ShotResponse updateShot(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @PathVariable String shotId,
            @RequestBody ShotRequest body,
            HttpServletRequest request
    ) {
        return production.updateShot(currentUser(request), pageId, id, shotId, body);
    }

    @DeleteMapping({"/creations/{id}/shots/{shotId}", "/pages/{pageId}/creations/{id}/shots/{shotId}"})
    public ResponseEntity<Void> deleteShot(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @PathVariable String shotId,
            HttpServletRequest request
    ) {
        production.deleteShot(currentUser(request), pageId, id, shotId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping({"/creations/{id}/shots/{shotId}/final", "/pages/{pageId}/creations/{id}/shots/{shotId}/final"})
    public ShotResponse setFinal(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @PathVariable String shotId,
            @RequestBody FinalFrameRequest body,
            HttpServletRequest request
    ) {
        return production.setFinal(currentUser(request), pageId, id, shotId, body);
    }

    @PutMapping({"/creations/{id}/items/{itemId}/shot", "/pages/{pageId}/creations/{id}/items/{itemId}/shot"})
    public CreationItemResponse moveItem(
            @PathVariable(required = false) String pageId,
            @PathVariable String id,
            @PathVariable String itemId,
            @RequestBody MoveItemRequest body,
            HttpServletRequest request
    ) {
        return production.moveItem(currentUser(request), pageId, id, itemId, body);
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
