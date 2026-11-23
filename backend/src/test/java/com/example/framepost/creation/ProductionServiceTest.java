package com.example.framepost.creation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.User;
import com.example.framepost.creation.CreationService.AddItemRequest;
import com.example.framepost.creation.CreationService.CreationItemResponse;
import com.example.framepost.creation.ProductionService.FinalFrameRequest;
import com.example.framepost.creation.ProductionService.MoveItemRequest;
import com.example.framepost.creation.ProductionService.SceneOrderRequest;
import com.example.framepost.creation.ProductionService.ShotRequest;
import com.example.framepost.creation.ProductionService.ShotStatus;
import com.example.framepost.generation.ContentGeneration;
import com.example.framepost.generation.GenerationResponse;
import com.example.framepost.generation.GenerationService;
import com.example.framepost.page.PageService;

class ProductionServiceTest {
    private final CreationRepository creations = mock(CreationRepository.class);
    private final CreationItemRepository items = mock(CreationItemRepository.class);
    private final SceneRepository scenes = mock(SceneRepository.class);
    private final ShotRepository shots = mock(ShotRepository.class);
    private final GenerationService generations = mock(GenerationService.class);
    private final PageService pages = mock(PageService.class);
    private final CreationService creationService = new CreationService(creations, items, scenes, shots, generations, pages);
    private final ProductionService service = new ProductionService(creationService, items, scenes, shots);
    private final User owner = new User("owner", "owner", "hash", Instant.now());
    private final Creation creation = new Creation("creation", "owner", null, "Lost City", null,
            Instant.now(), Instant.now());

    @BeforeEach
    void stubSaves() {
        when(items.save(any(CreationItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(shots.save(any(Shot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(scenes.save(any(Scene.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(creations.save(any(Creation.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(creations.findByIdAndUserId("creation", "owner")).thenReturn(Optional.of(creation));
    }

    @Test
    void statusFollowsTheFirstMatchingRule() {
        Shot empty = shot("shot", "scene", null, null);
        assertThat(ProductionService.status(empty, List.of())).isEqualTo(ShotStatus.NOT_STARTED);
        assertThat(ProductionService.status(shot("shot", "scene", "A ship lands", null), List.of()))
                .isEqualTo(ShotStatus.IMAGE_NEEDED);

        CreationItemResponse image = invocation("image", "IMAGE", ContentGeneration.Status.COMPLETED);
        CreationItemResponse video = invocation("video", "VIDEO", ContentGeneration.Status.COMPLETED);
        CreationItemResponse pending = invocation("pending", "IMAGE", ContentGeneration.Status.PROCESSING);

        assertThat(ProductionService.status(empty, List.of(pending))).isEqualTo(ShotStatus.IMAGE_NEEDED);
        assertThat(ProductionService.status(empty, List.of(image))).isEqualTo(ShotStatus.IMAGE_READY);
        assertThat(ProductionService.status(empty, List.of(image, video))).isEqualTo(ShotStatus.VIDEO_READY);
        assertThat(ProductionService.status(shot("shot", "scene", null, "image"), List.of(image, video)))
                .isEqualTo(ShotStatus.FINAL);
        assertThat(ProductionService.status(shot("shot", "scene", null, "gone"), List.of(image, video)))
                .isEqualTo(ShotStatus.VIDEO_READY);
    }

    @Test
    void createShotRejectsASceneFromAnotherCreation() {
        when(scenes.findByIdAndCreationId("other-scene", "creation")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createShot(owner, null, "creation",
                new ShotRequest("other-scene", "Reveal", null, null, null, null, null)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(shots, never()).save(any(Shot.class));
    }

    @Test
    void createShotRejectsDurationOutsideTheAllowedRange() {
        when(scenes.findByIdAndCreationId("scene", "creation")).thenReturn(Optional.of(scene("scene", 0)));

        assertThatThrownBy(() -> service.createShot(owner, null, "creation",
                new ShotRequest("scene", "Reveal", null, null, null, null, 0)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(shots, never()).save(any(Shot.class));
    }

    @Test
    void addItemDerivesSceneFromTheShotAndToolFromTheMediaType() {
        when(generations.getMany(owner, null, List.of("generation")))
                .thenReturn(List.of(generation("generation", ContentGeneration.MediaType.VIDEO)));
        when(items.existsByCreationIdAndGenerationId("creation", "generation")).thenReturn(false);
        when(items.findFirstByCreationIdOrderByPositionDesc("creation")).thenReturn(Optional.empty());
        when(shots.findByIdAndCreationId("shot", "creation")).thenReturn(Optional.of(shot("shot", "scene", null, null)));

        creationService.addItem(owner, null, "creation", new AddItemRequest("generation", null, "shot", null, null));

        verify(items).save(argThat(item -> "scene".equals(item.sceneId())
                && "shot".equals(item.shotId())
                && "VIDEO".equals(item.tool())));
    }

    @Test
    void addItemRejectsAParentFromAnotherShot() {
        when(generations.getMany(owner, null, List.of("generation")))
                .thenReturn(List.of(generation("generation", ContentGeneration.MediaType.IMAGE)));
        when(items.existsByCreationIdAndGenerationId("creation", "generation")).thenReturn(false);
        when(shots.findByIdAndCreationId("shot", "creation")).thenReturn(Optional.of(shot("shot", "scene", null, null)));
        when(items.findByIdAndCreationId("parent", "creation"))
                .thenReturn(Optional.of(item("parent", "other-shot", "scene", null, "IMAGE", "g0")));

        assertThatThrownBy(() -> creationService.addItem(owner, null, "creation",
                new AddItemRequest("generation", "parent", "shot", null, "IMAGE")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(items, never()).save(any(CreationItem.class));
    }

    @Test
    void moveItemDropsTheParentWhenTheParentStaysBehind() {
        CreationItem moving = item("item", "shot1", "scene1", "parent", "IMAGE", "g");
        when(items.findByIdAndCreationId("item", "creation")).thenReturn(Optional.of(moving));
        when(items.findByIdAndCreationId("parent", "creation"))
                .thenReturn(Optional.of(item("parent", "shot1", "scene1", null, "IMAGE", "p")));
        when(shots.findByIdAndCreationId("shot2", "creation")).thenReturn(Optional.of(shot("shot2", "scene2", null, null)));
        when(generations.getMany(owner, null, List.of("g")))
                .thenReturn(List.of(generation("g", ContentGeneration.MediaType.IMAGE)));

        service.moveItem(owner, null, "creation", "item", new MoveItemRequest("shot2"));

        verify(items).save(argThat(item -> item.parentItemId() == null
                && "shot2".equals(item.shotId())
                && "scene2".equals(item.sceneId())));
    }

    @Test
    void deleteShotDetachesItsInvocationsInsteadOfDeletingThem() {
        Shot shot = shot("shot1", "scene1", null, null);
        when(shots.findByIdAndCreationId("shot1", "creation")).thenReturn(Optional.of(shot));
        when(items.findByShotIdIn(List.of("shot1")))
                .thenReturn(List.of(item("item", "shot1", "scene1", null, "IMAGE", "g")));

        service.deleteShot(owner, null, "creation", "shot1");

        verify(items).saveAll(argThat((Iterable<CreationItem> saved) -> {
            CreationItem first = saved.iterator().next();
            return first.shotId() == null && first.sceneId() == null;
        }));
        verify(items, never()).delete(any(CreationItem.class));
        verify(shots).delete(shot);
    }

    @Test
    void reorderScenesRequiresEverySceneOnce() {
        when(scenes.findByCreationIdOrderByPositionAsc("creation")).thenReturn(List.of(
                scene("s1", 0), scene("s2", 1)));

        assertThatThrownBy(() -> service.reorderScenes(owner, null, "creation",
                new SceneOrderRequest(List.of("s1"))))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(scenes, never()).save(any(Scene.class));
    }

    @Test
    void setFinalRejectsAnItemFromAnotherShot() {
        when(shots.findByIdAndCreationId("shot1", "creation")).thenReturn(Optional.of(shot("shot1", "scene1", null, null)));
        when(items.findByIdAndCreationId("item", "creation"))
                .thenReturn(Optional.of(item("item", "shot2", "scene1", null, "IMAGE", "g")));

        assertThatThrownBy(() -> service.setFinal(owner, null, "creation", "shot1", new FinalFrameRequest("item")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(shots, never()).save(any(Shot.class));
    }

    @Test
    void outlineNestsInvocationsUnderTheirShotAndListsTheRest() {
        when(scenes.findByCreationIdOrderByPositionAsc("creation")).thenReturn(List.of(scene("scene1", 0)));
        when(shots.findByCreationIdOrderByPositionAsc("creation")).thenReturn(List.of(shot("shot1", "scene1", "Brief", null)));
        when(items.findByCreationIdOrderByPositionAsc("creation")).thenReturn(List.of(
                item("i1", "shot1", "scene1", null, "IMAGE", "g1"),
                item("i2", null, null, null, "IMAGE", "g2")));
        when(generations.getMany(owner, null, List.of("g1", "g2"))).thenReturn(List.of(
                generation("g1", ContentGeneration.MediaType.IMAGE),
                generation("g2", ContentGeneration.MediaType.IMAGE)));

        var outline = service.outline(owner, null, "creation");

        assertThat(outline.scenes()).hasSize(1);
        assertThat(outline.scenes().get(0).shots().get(0).invocations()).hasSize(1);
        assertThat(outline.scenes().get(0).shots().get(0).status()).isEqualTo(ShotStatus.IMAGE_READY);
        assertThat(outline.unassigned()).extracting(CreationItemResponse::id).containsExactly("i2");
    }

    @Test
    void outlinePlacesSceneOutputsUnderTheSceneNotUnassigned() {
        when(scenes.findByCreationIdOrderByPositionAsc("creation")).thenReturn(List.of(scene("scene1", 0)));
        when(shots.findByCreationIdOrderByPositionAsc("creation")).thenReturn(List.of());
        when(items.findByCreationIdOrderByPositionAsc("creation")).thenReturn(List.of(
                item("o1", null, "scene1", null, "IMAGE", "g1"),
                item("i2", null, null, null, "IMAGE", "g2")));
        when(generations.getMany(owner, null, List.of("g1", "g2"))).thenReturn(List.of(
                generation("g1", ContentGeneration.MediaType.IMAGE),
                generation("g2", ContentGeneration.MediaType.IMAGE)));

        var outline = service.outline(owner, null, "creation");

        assertThat(outline.scenes().get(0).outputs()).extracting(CreationItemResponse::id).containsExactly("o1");
        assertThat(outline.unassigned()).extracting(CreationItemResponse::id).containsExactly("i2");
    }

    @Test
    void deleteSceneReturnsItsSceneLevelOutputsToUnassigned() {
        when(scenes.findByIdAndCreationId("scene1", "creation")).thenReturn(Optional.of(scene("scene1", 0)));
        when(items.findByCreationIdOrderByPositionAsc("creation")).thenReturn(List.of(
                item("o1", null, "scene1", null, "IMAGE", "g1")));

        service.deleteScene(owner, null, "creation", "scene1");

        verify(items).saveAll(argThat((Iterable<CreationItem> saved) -> {
            CreationItem first = saved.iterator().next();
            return "o1".equals(first.id()) && first.sceneId() == null && first.shotId() == null;
        }));
        verify(scenes).delete(argThat((Scene deleted) -> "scene1".equals(deleted.id())));
    }

    @Test
    void addItemAttachesAGenerationToASceneWithoutAShot() {
        when(generations.getMany(owner, null, List.of("generation")))
                .thenReturn(List.of(generation("generation", ContentGeneration.MediaType.IMAGE)));
        when(items.existsByCreationIdAndGenerationId("creation", "generation")).thenReturn(false);
        when(items.findFirstByCreationIdOrderByPositionDesc("creation")).thenReturn(Optional.empty());
        when(scenes.findByIdAndCreationId("scene1", "creation")).thenReturn(Optional.of(scene("scene1", 0)));

        creationService.addItem(owner, null, "creation", new AddItemRequest("generation", null, null, "scene1", "IMAGE"));

        verify(items).save(argThat(item -> "scene1".equals(item.sceneId())
                && item.shotId() == null
                && "IMAGE".equals(item.tool())));
    }

    private static Scene scene(String id, int position) {
        return new Scene(id, "creation", "owner", position, "Scene", null, Instant.now(), Instant.now());
    }

    private static Shot shot(String id, String sceneId, String brief, String finalItemId) {
        return new Shot(id, "creation", sceneId, 0, "Shot", brief, null, List.of(), null, null, finalItemId,
                Instant.now(), Instant.now());
    }

    private static CreationItem item(String id, String shotId, String sceneId, String parentItemId, String tool,
                                     String generationId) {
        return new CreationItem(id, "creation", generationId, 0, parentItemId, sceneId, shotId, tool, Instant.now());
    }

    private static CreationItemResponse invocation(String id, String tool, ContentGeneration.Status status) {
        return new CreationItemResponse(id, "creation", 0, null, "scene", "shot", tool, Instant.now(),
                generation(id, null, status));
    }

    private static GenerationResponse generation(String id, ContentGeneration.MediaType mediaType) {
        return generation(id, mediaType, ContentGeneration.Status.COMPLETED);
    }

    private static GenerationResponse generation(String id, ContentGeneration.MediaType mediaType,
                                                 ContentGeneration.Status status) {
        return new GenerationResponse(id, "page", null, mediaType, null, null, Map.of(), status, null,
                Instant.now(), null, null, List.of(), List.of());
    }
}
