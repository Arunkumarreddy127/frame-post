package com.example.framepost.generation;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.User;
import com.example.framepost.generation.ContentGenerationStore.LibraryEntry;
import com.example.framepost.storage.StorageService;

class LibraryFileResolverTest {

    private final ContentGenerationStore store = mock(ContentGenerationStore.class);
    private final StorageService storage = mock(StorageService.class);
    private final LibraryFileResolver resolver = new LibraryFileResolver(store, storage);
    private final User user = new User("user-1", "name", "hash", Instant.now());
    private final String key = "outputs/name-user-1/g1/output-1.png";

    @Test
    void resolvesAnOwnedFileInScope() {
        when(store.findLibraryEntry("user-1", "p1", false, key)).thenReturn(Optional.of(
                new LibraryEntry("image/png", "output-1.png", new MediaMetadata(2L, 4, 4, null))));
        when(storage.read(key)).thenReturn(new byte[] {1, 2});

        LibraryFile file = resolver.resolve(user, "p1", key);

        assertEquals(key, file.key());
        assertEquals("image/png", file.contentType());
        assertArrayEquals(new byte[] {1, 2}, file.bytes());
    }

    @Test
    void rejectsAnotherUsersKeyWithoutTouchingStorage() {
        assertThrows(ResponseStatusException.class,
                () -> resolver.resolve(user, null, "outputs/other-user-2/g1/output-1.png"));
        verifyNoInteractions(store, storage);
    }

    @Test
    void rejectsAKeyThatIsNotInTheLibraryScope() {
        when(store.findLibraryEntry("user-1", null, false, key)).thenReturn(Optional.empty());
        assertThrows(ResponseStatusException.class, () -> resolver.resolve(user, null, key));
        verifyNoInteractions(storage);
    }

    @Test
    void recognisesReferencesByTheGenerationFolderInTheKey() {
        assertFalse(ContentInput.isReference("g1", "inputs/name-user-1/g1/a.png"));
        assertTrue(ContentInput.isReference("g2", key));
    }
}
