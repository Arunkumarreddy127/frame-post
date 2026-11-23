package com.example.framepost.creation;

import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.User;
import com.example.framepost.creation.CreationService.CreationItemResponse;
import com.example.framepost.generation.ContentGeneration;

/**
 * Scenes and shots inside a creation. Tool invocations stay as {@link CreationItem} rows and are attached
 * to a shot through {@code shotId}.
 */
@Service
public class ProductionService {

    private static final int MAX_TITLE_LENGTH = 120;
    private static final int MAX_BRIEF_LENGTH = 2000;

    private final CreationService creations;
    private final CreationItemRepository items;
    private final SceneRepository scenes;
    private final ShotRepository shots;

    public ProductionService(
            CreationService creations,
            CreationItemRepository items,
            SceneRepository scenes,
            ShotRepository shots
    ) {
        this.creations = creations;
        this.items = items;
        this.scenes = scenes;
        this.shots = shots;
    }

    public enum ShotStatus {
        NOT_STARTED, IMAGE_NEEDED, IMAGE_READY, VIDEO_READY, FINAL
    }

    public record SceneRequest(String title, String description) {
    }

    public record ShotRequest(
            String sceneId,
            String title,
            String brief,
            String shotSize,
            List<String> shotTypes,
            String movement,
            Integer durationSeconds
    ) {
    }

    public record SceneOrderRequest(List<String> sceneIds) {
    }

    public record ShotOrderRequest(String sceneId, List<String> shotIds) {
    }

    public record FinalFrameRequest(String itemId) {
    }

    public record MoveItemRequest(String shotId) {
    }

    public record OutlineResponse(
            String creationId,
            List<SceneOutline> scenes,
            List<CreationItemResponse> unassigned
    ) {
    }

    public record SceneOutline(
            String id,
            String creationId,
            int position,
            String title,
            String description,
            List<ShotOutline> shots,
            List<CreationItemResponse> outputs
    ) {
    }

    public record ShotOutline(
            String id,
            String creationId,
            String sceneId,
            int position,
            String title,
            String brief,
            String shotSize,
            List<String> shotTypes,
            String movement,
            Integer durationSeconds,
            String finalItemId,
            ShotStatus status,
            List<CreationItemResponse> invocations
    ) {
    }

    public record SceneResponse(String id, String creationId, int position, String title, String description,
                                Instant createdAt, Instant updatedAt) {
    }

    public record ShotResponse(String id, String creationId, String sceneId, int position, String title,
                               String brief, String shotSize, List<String> shotTypes, String movement,
                               Integer durationSeconds, String finalItemId, Instant createdAt, Instant updatedAt) {
    }

    public OutlineResponse outline(User user, String pageId, String creationId) {
        creations.load(user, pageId, creationId);
        List<CreationItemResponse> all = creations.toItemResponses(user, pageId,
                items.findByCreationIdOrderByPositionAsc(creationId));
        Map<String, List<CreationItemResponse>> invocationsByShot = all.stream()
                .filter(item -> item.shotId() != null)
                .collect(Collectors.groupingBy(CreationItemResponse::shotId));
        List<Shot> allShots = shots.findByCreationIdOrderByPositionAsc(creationId);
        Map<String, List<Shot>> shotsByScene = allShots.stream()
                .collect(Collectors.groupingBy(Shot::sceneId));
        Set<String> knownShotIds = allShots.stream()
                .map(Shot::id)
                .collect(Collectors.toSet());
        List<Scene> allScenes = scenes.findByCreationIdOrderByPositionAsc(creationId);
        Set<String> knownSceneIds = allScenes.stream()
                .map(Scene::id)
                .collect(Collectors.toSet());
        // Outputs generated from a scene without a shot. They stay attached to the scene until moved into a shot.
        Map<String, List<CreationItemResponse>> outputsByScene = all.stream()
                .filter(item -> item.shotId() == null && item.sceneId() != null)
                .collect(Collectors.groupingBy(CreationItemResponse::sceneId));

        List<SceneOutline> sceneOutlines = allScenes.stream()
                .map(scene -> new SceneOutline(
                        scene.id(),
                        scene.creationId(),
                        scene.position(),
                        scene.title(),
                        scene.description(),
                        shotsByScene.getOrDefault(scene.id(), List.of()).stream()
                                .map(shot -> toShotOutline(shot, invocationsByShot.getOrDefault(shot.id(), List.of())))
                                .toList(),
                        outputsByScene.getOrDefault(scene.id(), List.of())))
                .toList();
        List<CreationItemResponse> unassigned = all.stream()
                .filter(item -> !placed(item, knownShotIds, knownSceneIds))
                .toList();
        return new OutlineResponse(creationId, sceneOutlines, unassigned);
    }

    public SceneResponse createScene(User user, String pageId, String creationId, SceneRequest request) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        int position = scenes.findFirstByCreationIdOrderByPositionDesc(creationId)
                .map(last -> last.position() + 1)
                .orElse(0);
        Instant now = Instant.now();
        Scene saved = scenes.save(new Scene(
                null,
                creationId,
                creation.userId(),
                position,
                title(request == null ? null : request.title()),
                description(request == null ? null : request.description()),
                now,
                now));
        creations.touch(creation.creation());
        return toSceneResponse(saved);
    }

    public SceneResponse updateScene(User user, String pageId, String creationId, String sceneId,
                                     SceneRequest request) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        Scene scene = requireScene(creationId, sceneId);
        Scene saved = scenes.save(new Scene(
                scene.id(),
                scene.creationId(),
                scene.userId(),
                scene.position(),
                title(request == null ? null : request.title()),
                description(request == null ? null : request.description()),
                scene.createdAt(),
                Instant.now()));
        creations.touch(creation.creation());
        return toSceneResponse(saved);
    }

    /**
     * Deletes a scene and its shots. Tool invocations from those shots and scene-level outputs stay in the
     * creation, unassigned.
     */
    public void deleteScene(User user, String pageId, String creationId, String sceneId) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        Scene scene = requireScene(creationId, sceneId);
        List<Shot> sceneShots = shots.findBySceneIdOrderByPositionAsc(scene.id());
        detachItems(sceneShots.stream().map(Shot::id).toList());
        List<CreationItem> sceneOutputs = items.findByCreationIdOrderByPositionAsc(creationId).stream()
                .filter(item -> scene.id().equals(item.sceneId()) && item.shotId() == null)
                .map(item -> withPlacement(item, null, null))
                .toList();
        items.saveAll(sceneOutputs);
        shots.deleteAll(sceneShots);
        scenes.delete(scene);
        creations.touch(creation.creation());
    }

    /** Sets the scene order. The body must list every scene in the creation exactly once. */
    public OutlineResponse reorderScenes(User user, String pageId, String creationId, SceneOrderRequest request) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        List<Scene> existing = scenes.findByCreationIdOrderByPositionAsc(creationId);
        List<String> ordered = requireOrder(existing.stream().map(Scene::id).toList(),
                request == null ? null : request.sceneIds(), "scene");
        Map<String, Scene> byId = existing.stream().collect(Collectors.toMap(Scene::id, Function.identity()));
        for (int position = 0; position < ordered.size(); position++) {
            Scene scene = byId.get(ordered.get(position));
            if (scene.position() != position) {
                scenes.save(new Scene(scene.id(), scene.creationId(), scene.userId(), position, scene.title(),
                        scene.description(), scene.createdAt(), Instant.now()));
            }
        }
        creations.touch(creation.creation());
        return outline(user, pageId, creationId);
    }

    public ShotResponse createShot(User user, String pageId, String creationId, ShotRequest request) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        if (request == null || request.sceneId() == null) {
            throw badRequest("Scene is required");
        }
        requireScene(creationId, request.sceneId());
        int position = shots.findFirstBySceneIdOrderByPositionDesc(request.sceneId())
                .map(last -> last.position() + 1)
                .orElse(0);
        Instant now = Instant.now();
        Shot saved = shots.save(buildShot(null, creationId, request.sceneId(), position, request, null, now, now));
        creations.touch(creation.creation());
        return toShotResponse(saved);
    }

    /**
     * Updates a shot's fields. A different {@code sceneId} moves the shot to the end of that scene and
     * moves its tool invocations with it.
     */
    public ShotResponse updateShot(User user, String pageId, String creationId, String shotId, ShotRequest request) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        Shot shot = requireShot(creationId, shotId);
        if (request == null || request.sceneId() == null) {
            throw badRequest("Scene is required");
        }
        requireScene(creationId, request.sceneId());
        int position = shot.position();
        boolean sceneChanged = !Objects.equals(shot.sceneId(), request.sceneId());
        if (sceneChanged) {
            position = shots.findFirstBySceneIdOrderByPositionDesc(request.sceneId())
                    .map(last -> last.position() + 1)
                    .orElse(0);
        }
        Instant now = Instant.now();
        Shot saved = shots.save(buildShot(shot.id(), creationId, request.sceneId(), position, request,
                shot.finalItemId(), shot.createdAt(), now));
        if (sceneChanged) {
            List<CreationItem> invocations = items.findByShotIdIn(List.of(shot.id()));
            items.saveAll(invocations.stream()
                    .map(item -> withPlacement(item, item.shotId(), request.sceneId()))
                    .toList());
        }
        creations.touch(creation.creation());
        return toShotResponse(saved);
    }

    /** Deletes a shot. Its tool invocations stay in the creation, unassigned. */
    public void deleteShot(User user, String pageId, String creationId, String shotId) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        Shot shot = requireShot(creationId, shotId);
        detachItems(List.of(shot.id()));
        shots.delete(shot);
        creations.touch(creation.creation());
    }

    /** Sets the order of the shots in one scene. The body must list every shot in that scene exactly once. */
    public OutlineResponse reorderShots(User user, String pageId, String creationId, ShotOrderRequest request) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        if (request == null || request.sceneId() == null) {
            throw badRequest("Scene is required");
        }
        requireScene(creationId, request.sceneId());
        List<Shot> existing = shots.findBySceneIdOrderByPositionAsc(request.sceneId());
        List<String> ordered = requireOrder(existing.stream().map(Shot::id).toList(), request.shotIds(), "shot");
        Map<String, Shot> byId = existing.stream().collect(Collectors.toMap(Shot::id, Function.identity()));
        for (int position = 0; position < ordered.size(); position++) {
            Shot shot = byId.get(ordered.get(position));
            if (shot.position() != position) {
                shots.save(withPosition(shot, position));
            }
        }
        creations.touch(creation.creation());
        return outline(user, pageId, creationId);
    }

    /** Marks one of the shot's tool invocations as its final output. A null item clears the choice. */
    public ShotResponse setFinal(User user, String pageId, String creationId, String shotId, FinalFrameRequest request) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        Shot shot = requireShot(creationId, shotId);
        String itemId = request == null ? null : request.itemId();
        if (itemId != null) {
            CreationItem item = items.findByIdAndCreationId(itemId, creationId)
                    .orElseThrow(() -> badRequest("Item is not in this creation"));
            if (!Objects.equals(item.shotId(), shot.id())) {
                throw badRequest("Item is not an invocation of this shot");
            }
        }
        Shot saved = shots.save(new Shot(
                shot.id(),
                shot.creationId(),
                shot.sceneId(),
                shot.position(),
                shot.title(),
                shot.brief(),
                shot.shotSize(),
                shot.shotTypes(),
                shot.movement(),
                shot.durationSeconds(),
                itemId,
                shot.createdAt(),
                Instant.now()));
        creations.touch(creation.creation());
        return toShotResponse(saved);
    }

    /**
     * Moves a tool invocation to another shot, or to unassigned when {@code shotId} is null. The scene follows
     * the shot. A parent link survives only when the parent is in the same shot.
     */
    public CreationItemResponse moveItem(User user, String pageId, String creationId, String itemId,
                                         MoveItemRequest request) {
        CreationRecord creation = loadCreation(user, pageId, creationId);
        CreationItem item = items.findByIdAndCreationId(itemId, creationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        String targetShotId = request == null ? null : CreationService.optionalText(request.shotId(), "Shot", 128);
        String targetSceneId = null;
        if (targetShotId != null) {
            targetSceneId = requireShot(creationId, targetShotId).sceneId();
        }
        if (Objects.equals(item.shotId(), targetShotId)) {
            return singleItem(user, pageId, item);
        }
        String parentItemId = item.parentItemId();
        if (parentItemId != null) {
            CreationItem parent = items.findByIdAndCreationId(parentItemId, creationId).orElse(null);
            if (parent == null || !Objects.equals(parent.shotId(), targetShotId)) {
                parentItemId = null;
            }
        }
        CreationItem moved = new CreationItem(item.id(), item.creationId(), item.generationId(), item.position(),
                parentItemId, targetSceneId, targetShotId, item.tool(), item.createdAt());
        items.save(moved);
        // Children that pointed at this item can't keep a parent in a different shot.
        List<CreationItem> orphans = items.findByCreationIdOrderByPositionAsc(creationId).stream()
                .filter(child -> item.id().equals(child.parentItemId()) && !Objects.equals(child.shotId(), targetShotId))
                .map(child -> new CreationItem(child.id(), child.creationId(), child.generationId(), child.position(),
                        null, child.sceneId(), child.shotId(), child.tool(), child.createdAt()))
                .toList();
        items.saveAll(orphans);
        creations.touch(creation.creation());
        return singleItem(user, pageId, moved);
    }

    private CreationItemResponse singleItem(User user, String pageId, CreationItem item) {
        return creations.toItemResponses(user, pageId, List.of(item)).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Generation not found"));
    }

    static ShotStatus status(Shot shot, List<CreationItemResponse> invocations) {
        if (shot.finalItemId() != null
                && invocations.stream().anyMatch(item -> shot.finalItemId().equals(item.id()))) {
            return ShotStatus.FINAL;
        }
        if (invocations.stream().anyMatch(item -> completed(item, ContentGeneration.MediaType.VIDEO))) {
            return ShotStatus.VIDEO_READY;
        }
        if (invocations.stream().anyMatch(item -> completed(item, ContentGeneration.MediaType.IMAGE))) {
            return ShotStatus.IMAGE_READY;
        }
        if ((shot.brief() != null && !shot.brief().isBlank()) || !invocations.isEmpty()) {
            return ShotStatus.IMAGE_NEEDED;
        }
        return ShotStatus.NOT_STARTED;
    }

    private static boolean completed(CreationItemResponse item, ContentGeneration.MediaType mediaType) {
        return item.generation() != null
                && item.generation().status() == ContentGeneration.Status.COMPLETED
                && item.tool() != null
                && item.tool().equals(mediaType.name());
    }

    private ShotOutline toShotOutline(Shot shot, List<CreationItemResponse> invocations) {
        return new ShotOutline(
                shot.id(),
                shot.creationId(),
                shot.sceneId(),
                shot.position(),
                shot.title(),
                shot.brief(),
                shot.shotSize(),
                shot.shotTypes(),
                shot.movement(),
                shot.durationSeconds(),
                shot.finalItemId(),
                status(shot, invocations),
                invocations);
    }

    private CreationRecord loadCreation(User user, String pageId, String creationId) {
        var creation = creations.load(user, pageId, creationId);
        return new CreationRecord(creation, creation.userId());
    }

    private Scene requireScene(String creationId, String sceneId) {
        return scenes.findByIdAndCreationId(sceneId, creationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Scene not found"));
    }

    private Shot requireShot(String creationId, String shotId) {
        return shots.findByIdAndCreationId(shotId, creationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shot not found"));
    }

    private void detachItems(Collection<String> shotIds) {
        if (shotIds.isEmpty()) {
            return;
        }
        items.saveAll(items.findByShotIdIn(shotIds).stream()
                .map(item -> withPlacement(item, null, null))
                .toList());
    }

    private static boolean placed(CreationItemResponse item, Set<String> knownShotIds, Set<String> knownSceneIds) {
        if (item.shotId() != null) {
            return knownShotIds.contains(item.shotId());
        }
        return item.sceneId() != null && knownSceneIds.contains(item.sceneId());
    }

    private static CreationItem withPlacement(CreationItem item, String shotId, String sceneId) {
        return new CreationItem(item.id(), item.creationId(), item.generationId(), item.position(),
                item.parentItemId(), sceneId, shotId, item.tool(), item.createdAt());
    }

    private static Shot withPosition(Shot shot, int position) {
        return new Shot(shot.id(), shot.creationId(), shot.sceneId(), position, shot.title(), shot.brief(),
                shot.shotSize(), shot.shotTypes(), shot.movement(), shot.durationSeconds(), shot.finalItemId(),
                shot.createdAt(), Instant.now());
    }

    private static Shot buildShot(String id, String creationId, String sceneId, int position, ShotRequest request,
                                  String finalItemId, Instant createdAt, Instant updatedAt) {
        return new Shot(
                id,
                creationId,
                sceneId,
                position,
                title(request.title()),
                CreationService.optionalText(request.brief(), "Brief", MAX_BRIEF_LENGTH),
                ShotFields.choice(request.shotSize(), "Shot size"),
                ShotFields.shotTypes(request.shotTypes()),
                ShotFields.choice(request.movement(), "Movement"),
                ShotFields.duration(request.durationSeconds()),
                finalItemId,
                createdAt,
                updatedAt);
    }

    private static String title(String value) {
        return CreationService.requiredText(value, "Title", MAX_TITLE_LENGTH);
    }

    private static String description(String value) {
        return CreationService.optionalText(value, "Description", 2000);
    }

    /** Checks that the requested ids are exactly the current ids, each once, and returns them. */
    private static List<String> requireOrder(List<String> currentIds, List<String> requested, String kind) {
        if (requested == null) {
            throw badRequest(kind + " order is required");
        }
        Set<String> seen = new HashSet<>();
        for (String id : requested) {
            if (id == null || !seen.add(id)) {
                throw badRequest("Reorder must name each " + kind + " once");
            }
        }
        if (!seen.equals(new HashSet<>(currentIds))) {
            throw badRequest("Reorder must name every " + kind + " in the group");
        }
        return List.copyOf(requested);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static SceneResponse toSceneResponse(Scene scene) {
        return new SceneResponse(scene.id(), scene.creationId(), scene.position(), scene.title(),
                scene.description(), scene.createdAt(), scene.updatedAt());
    }

    private static ShotResponse toShotResponse(Shot shot) {
        return new ShotResponse(shot.id(), shot.creationId(), shot.sceneId(), shot.position(), shot.title(),
                shot.brief(), shot.shotSize(), shot.shotTypes(), shot.movement(), shot.durationSeconds(),
                shot.finalItemId(), shot.createdAt(), shot.updatedAt());
    }

    private record CreationRecord(com.example.framepost.creation.Creation creation, String userId) {
    }
}
