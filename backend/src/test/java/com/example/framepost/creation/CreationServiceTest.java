package com.example.framepost.creation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.User;
import com.example.framepost.creation.CreationService.AddItemRequest;
import com.example.framepost.creation.CreationService.ItemPlacement;
import com.example.framepost.creation.CreationService.ReorderRequest;
import com.example.framepost.generation.GenerationResponse;
import com.example.framepost.generation.GenerationService;
import com.example.framepost.page.PageService;

class CreationServiceTest {
    private final CreationRepository creations = mock(CreationRepository.class);
    private final CreationItemRepository items = mock(CreationItemRepository.class);
    private final SceneRepository scenes = mock(SceneRepository.class);
    private final ShotRepository shots = mock(ShotRepository.class);
    private final GenerationService generations = mock(GenerationService.class);
    private final PageService pages = mock(PageService.class);
    private final CreationService service = new CreationService(creations, items, scenes, shots, generations, pages);
    private final User owner = new User("owner", "owner", "hash", Instant.now());
    private final Creation creation = new Creation("creation", "owner", null, "Launch", null,
            Instant.now(), Instant.now());

    @BeforeEach
    void stubSave() {
        when(items.save(any(CreationItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(creations.save(any(Creation.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void addItemAppendsAfterTheLastPosition() {
        when(creations.findByIdAndUserId("creation", "owner")).thenReturn(Optional.of(creation));
        when(generations.getMany(owner, null, List.of("generation"))).thenReturn(List.of(mock(GenerationResponse.class)));
        when(items.existsByCreationIdAndGenerationId("creation", "generation")).thenReturn(false);
        when(items.findFirstByCreationIdOrderByPositionDesc("creation"))
                .thenReturn(Optional.of(new CreationItem("last", "creation", "other", 4, null, null, null, null, Instant.now())));

        service.addItem(owner, null, "creation", new AddItemRequest("generation", null, null, null, null));

        verify(items).save(org.mockito.ArgumentMatchers.argThat(item -> item.position() == 5));
    }

    @Test
    void addItemRejectsAGenerationThatAlreadyBelongsToThisCreation() {
        when(creations.findByIdAndUserId("creation", "owner")).thenReturn(Optional.of(creation));
        when(generations.getMany(owner, null, List.of("generation"))).thenReturn(List.of(mock(GenerationResponse.class)));
        when(items.existsByCreationIdAndGenerationId("creation", "generation")).thenReturn(true);

        assertThatThrownBy(() -> service.addItem(owner, null, "creation", new AddItemRequest("generation", null, null, null, null)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(items, never()).save(any(CreationItem.class));
    }

    @Test
    void addItemChecksDuplicatesOnlyWithinTheTargetCreation() {
        when(creations.findByIdAndUserId("creation", "owner")).thenReturn(Optional.of(creation));
        when(generations.getMany(owner, null, List.of("generation"))).thenReturn(List.of(mock(GenerationResponse.class)));
        when(items.existsByCreationIdAndGenerationId("creation", "generation")).thenReturn(false);

        service.addItem(owner, null, "creation", new AddItemRequest("generation", null, null, null, null));

        verify(items).existsByCreationIdAndGenerationId("creation", "generation");
        verify(items, never()).existsByCreationIdAndGenerationId("other-creation", "generation");
        verify(items).save(any(CreationItem.class));
    }

    @Test
    void addItemRejectsAGenerationOutsideTheScope() {
        when(creations.findByIdAndUserId("creation", "owner")).thenReturn(Optional.of(creation));
        when(generations.getMany(owner, null, List.of("someone-else"))).thenReturn(List.of());

        assertThatThrownBy(() -> service.addItem(owner, null, "creation", new AddItemRequest("someone-else", null, null, null, null)))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(items, never()).save(any(CreationItem.class));
    }

    @Test
    void reorderRejectsAPartialList() {
        when(creations.findByIdAndUserId("creation", "owner")).thenReturn(Optional.of(creation));
        when(items.findByCreationIdOrderByPositionAsc("creation")).thenReturn(List.of(
                new CreationItem("a", "creation", "g1", 0, null, null, null, null, Instant.now()),
                new CreationItem("b", "creation", "g2", 1, null, null, null, null, Instant.now())));

        assertThatThrownBy(() -> service.reorder(owner, null, "creation",
                new ReorderRequest(List.of(new ItemPlacement("a")))))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(items, never()).saveAll(any());
    }

    @Test
    void deleteRemovesMembershipsBeforeTheCreation() {
        when(creations.findByIdAndUserId("creation", "owner")).thenReturn(Optional.of(creation));

        service.delete(owner, null, "creation");

        verify(items).deleteByCreationId("creation");
        verify(shots).deleteByCreationId("creation");
        verify(scenes).deleteByCreationId("creation");
        verify(creations).delete(creation);
    }
}
