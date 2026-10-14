package com.example.framepost.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import com.example.framepost.auth.User;
import org.junit.jupiter.api.Test;

class StorageKeysTest {

    private final User user = new User("u1", "Jane Doe", "hash", Instant.now());

    @Test
    void buildsInputAndOutputPrefixesWithSlugUsernameAndUserId() {
        assertEquals("inputs/jane-doe-u1/gen-1/", StorageKeys.inputPrefix(user, "gen-1"));
        assertEquals("outputs/jane-doe-u1/gen-1/", StorageKeys.outputPrefix(user, "gen-1"));
    }

    @Test
    void kebabCasesOriginalNameAndUsesExtensionFromContentType() {
        Set<String> used = new HashSet<>();
        assertEquals("my-cool-photo-v2.png",
                StorageKeys.fileName("My Cool_Photo.v2.JPG", "png", "input-1", used));
    }

    @Test
    void fallsBackWhenNameIsMissingOrHasNoSafeCharacters() {
        Set<String> used = new HashSet<>();
        assertEquals("input-1.png", StorageKeys.fileName(null, "png", "input-1", used));
        assertEquals("image.webp", StorageKeys.fileName("!!!.webp", "webp", "image", used));
    }

    @Test
    void suffixesDuplicateNamesWithinOneGeneration() {
        Set<String> used = new HashSet<>();
        assertEquals("frame.png", StorageKeys.fileName("frame.png", "png", "x", used));
        assertEquals("frame-2.png", StorageKeys.fileName("frame.png", "png", "x", used));
        assertEquals("frame-3.png", StorageKeys.fileName("frame.png", "png", "x", used));
    }

    @Test
    void stripsDirectoryPartsFromOriginalName() {
        assertEquals("frame.png", StorageKeys.fileName("C:\\pics\\frame.png", "png", "x", new HashSet<>()));
        assertEquals("frame.png", StorageKeys.fileName("../pics/frame.png", "png", "x", new HashSet<>()));
    }

    @Test
    void usesUserFallbackWhenUsernameHasNoSafeCharacters() {
        User odd = new User("u2", "!!", "hash", Instant.now());
        assertEquals("inputs/user-u2/g/", StorageKeys.inputPrefix(odd, "g"));
    }
}
