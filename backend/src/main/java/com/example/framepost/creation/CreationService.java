package com.example.framepost.creation;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.User;
import com.example.framepost.generation.GenerationResponse;
import com.example.framepost.generation.GenerationService;
import com.example.framepost.page.PageService;

/**
 * Creations are groups of generations owned by one user and scoped like generations: either global
 * ({@code pageId} null) or to one owned page. Deleting a creation only removes its memberships; the
 * generations and their files stay in the Library.
 */
@Service
public class CreationService {

    private static final int MAX_NAME_LENGTH = 120;
    private static final int MAX_DESCRIPTION_LENGTH = 2000;
    private static final int MAX_LANE_LENGTH = 64;
    private static final int MAX_ID_LENGTH = 128;

    private final CreationRepository creations;
    private final CreationItemRepository items;
    private final GenerationService generations;
    private final PageService pageService;

    public CreationService(
            CreationRepository creations,
            CreationItemRepository items,
            GenerationService generations,
            PageService pageService
    ) {
        this.creations = creations;
        this.items = items;
        this.generations = generations;
        this.pageService = pageService;
    }

    public record CreationRequest(String name, String description) {
    }

    public record AddItemRequest(String generationId, String laneId, String parentItemId) {
    }

    public record ItemPlacement(String itemId, String laneId) {
    }

    public record ReorderRequest(List<ItemPlacement> items) {
    }

    public record CreationResponse(
            String id,
            String pageId,
            String name,
            String description,
            int itemCount,
            String coverGenerationId,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record CreationItemResponse(
            String id,
            String creationId,
            int position,
            String laneId,
            String parentItemId,
            Instant addedAt,
            GenerationResponse generation
    ) {
    }

    /** Newest-updated first. A null {@code pageId} lists only global creations. */
    public List<CreationResponse> list(User user, String pageId) {
        validateScope(user, pageId);
        List<Creation> rows = pageId == null
                ? creations.findByUserIdAndPageIdIsNullOrderByUpdatedAtDesc(user.id())
                : creations.findByUserIdAndPageIdOrderByUpdatedAtDesc(user.id(), pageId);
        if (rows.isEmpty()) {
            return List.of();
        }
        List<String> ids = rows.stream().map(Creation::id).toList();
        Map<String, List<CreationItem>> membership = items.findByCreationIdIn(ids).stream()
                .collect(Collectors.groupingBy(CreationItem::creationId));
        return rows.stream()
                .map(creation -> toResponse(creation, membership.getOrDefault(creation.id(), List.of())))
                .toList();
    }

    public CreationResponse create(User user, String pageId, CreationRequest request) {
        validateScope(user, pageId);
        Instant now = Instant.now();
        Creation saved = creations.save(new Creation(
                null,
                user.id(),
                pageId,
                requiredText(request.name(), "Name", MAX_NAME_LENGTH),
                optionalText(request.description(), "Description", MAX_DESCRIPTION_LENGTH),
                now,
                now));
        return toResponse(saved, List.of());
    }

    public CreationResponse get(User user, String pageId, String id) {
        Creation creation = load(user, pageId, id);
        return toResponse(creation, items.findByCreationIdOrderByPositionAsc(id));
    }

    public CreationResponse update(User user, String pageId, String id, CreationRequest request) {
        Creation existing = load(user, pageId, id);
        Creation updated = creations.save(new Creation(
                existing.id(),
                existing.userId(),
                existing.pageId(),
                requiredText(request.name(), "Name", MAX_NAME_LENGTH),
                optionalText(request.description(), "Description", MAX_DESCRIPTION_LENGTH),
                existing.createdAt(),
                Instant.now()));
        return toResponse(updated, items.findByCreationIdOrderByPositionAsc(id));
    }

    public void delete(User user, String pageId, String id) {
        Creation creation = load(user, pageId, id);
        // Memberships go first: a crash then leaves an empty creation rather than generations locked to a missing one.
        items.deleteByCreationId(id);
        creations.delete(creation);
    }

    /** Members of a creation in position order. Members whose generation is gone are omitted. */
    public List<CreationItemResponse> listItems(User user, String pageId, String id) {
        load(user, pageId, id);
        return toItemResponses(user, pageId, items.findByCreationIdOrderByPositionAsc(id));
    }

    /** Adds a generation to the end of the creation. Each generation can belong to only one creation. */
    public CreationItemResponse addItem(User user, String pageId, String id, AddItemRequest request) {
        Creation creation = load(user, pageId, id);
        String generationId = requiredText(request.generationId(), "Generation", MAX_ID_LENGTH);
        GenerationResponse generation = generations.getMany(user, pageId, List.of(generationId)).stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Generation not found"));
        if (items.existsByGenerationId(generationId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Generation is already in a creation");
        }
        String parentItemId = optionalText(request.parentItemId(), "Parent item", MAX_ID_LENGTH);
        if (parentItemId != null && items.findByIdAndCreationId(parentItemId, id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parent item is not in this creation");
        }
        int position = items.findFirstByCreationIdOrderByPositionDesc(id)
                .map(last -> last.position() + 1)
                .orElse(0);
        CreationItem saved;
        try {
            saved = items.save(new CreationItem(
                    null,
                    id,
                    generationId,
                    position,
                    optionalText(request.laneId(), "Lane", MAX_LANE_LENGTH),
                    parentItemId,
                    Instant.now()));
        } catch (DuplicateKeyException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Generation is already in a creation", exception);
        }
        touch(creation);
        return new CreationItemResponse(saved.id(), saved.creationId(), saved.position(), saved.laneId(),
                saved.parentItemId(), saved.createdAt(), generation);
    }

    /** Which of the given generations already belong to a creation. Only generations in scope are considered. */
    public List<String> groupedGenerationIds(User user, String pageId, List<String> generationIds) {
        List<String> inScope = generations.getMany(user, pageId, generationIds).stream()
                .map(GenerationResponse::id)
                .toList();
        if (inScope.isEmpty()) {
            return List.of();
        }
        return items.findByGenerationIdIn(inScope).stream().map(CreationItem::generationId).toList();
    }

    public void removeItem(User user, String pageId, String id, String itemId) {
        Creation creation = load(user, pageId, id);
        CreationItem item = items.findByIdAndCreationId(itemId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        items.delete(item);
        touch(creation);
    }

    /**
     * Sets the full order and lane of a creation. The request must name every current item exactly once,
     * so a stale client cannot silently drop or duplicate memberships.
     */
    public List<CreationItemResponse> reorder(User user, String pageId, String id, ReorderRequest request) {
        Creation creation = load(user, pageId, id);
        List<CreationItem> existing = items.findByCreationIdOrderByPositionAsc(id);
        if (request == null || request.items() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Items are required");
        }
        Map<String, CreationItem> byId = existing.stream()
                .collect(Collectors.toMap(CreationItem::id, Function.identity()));
        Set<String> requested = new HashSet<>();
        for (ItemPlacement placement : request.items()) {
            if (placement == null || placement.itemId() == null || !requested.add(placement.itemId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reorder must name each item once");
            }
        }
        if (!requested.equals(byId.keySet())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reorder must name every item in the creation");
        }
        List<CreationItem> reordered = new ArrayList<>();
        for (int position = 0; position < request.items().size(); position++) {
            ItemPlacement placement = request.items().get(position);
            CreationItem old = byId.get(placement.itemId());
            reordered.add(new CreationItem(
                    old.id(),
                    old.creationId(),
                    old.generationId(),
                    position,
                    optionalText(placement.laneId(), "Lane", MAX_LANE_LENGTH),
                    old.parentItemId(),
                    old.createdAt()));
        }
        items.saveAll(reordered);
        touch(creation);
        return toItemResponses(user, pageId, items.findByCreationIdOrderByPositionAsc(id));
    }

    private Creation load(User user, String pageId, String id) {
        validateScope(user, pageId);
        return creations.findByIdAndUserId(id, user.id())
                .filter(creation -> Objects.equals(creation.pageId(), pageId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Creation not found"));
    }

    private void touch(Creation creation) {
        creations.save(new Creation(
                creation.id(),
                creation.userId(),
                creation.pageId(),
                creation.name(),
                creation.description(),
                creation.createdAt(),
                Instant.now()));
    }

    private List<CreationItemResponse> toItemResponses(User user, String pageId, List<CreationItem> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<String, GenerationResponse> byId = generations.getMany(
                        user, pageId, rows.stream().map(CreationItem::generationId).toList()).stream()
                .collect(Collectors.toMap(GenerationResponse::id, Function.identity()));
        return rows.stream()
                .filter(row -> byId.containsKey(row.generationId()))
                .map(row -> new CreationItemResponse(row.id(), row.creationId(), row.position(), row.laneId(),
                        row.parentItemId(), row.createdAt(), byId.get(row.generationId())))
                .toList();
    }

    private CreationResponse toResponse(Creation creation, List<CreationItem> members) {
        String cover = members.stream()
                .min(Comparator.comparingInt(CreationItem::position))
                .map(CreationItem::generationId)
                .orElse(null);
        return new CreationResponse(
                creation.id(),
                creation.pageId(),
                creation.name(),
                creation.description(),
                members.size(),
                cover,
                creation.createdAt(),
                creation.updatedAt());
    }

    private void validateScope(User user, String pageId) {
        if (pageId != null) {
            pageService.get(user, pageId);
        }
    }

    private static String requiredText(String value, String field, int maxLength) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        if (trimmed.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    field + " must be at most " + maxLength + " characters");
        }
        return trimmed;
    }

    private static String optionalText(String value, String field, int maxLength) {
        return value == null || value.isBlank() ? null : requiredText(value, field, maxLength);
    }
}
