package com.example.framepost.generation;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.exception.SdkException;

import com.example.framepost.auth.User;
import com.example.framepost.storage.StorageKeys;
import com.example.framepost.storage.StorageService;

/** Turns Library file keys sent by the client into files the signed-in user owns in the current scope. */
@Component
public class LibraryFileResolver {

    private final ContentGenerationStore store;
    private final StorageService storage;

    public LibraryFileResolver(ContentGenerationStore store, StorageService storage) {
        this.store = store;
        this.storage = storage;
    }

    public List<LibraryFile> resolve(User user, String pageId, List<String> keys) {
        List<LibraryFile> files = new ArrayList<>();
        for (String key : new LinkedHashSet<>(keys == null ? List.<String>of() : keys)) {
            if (key == null || key.isBlank()) {
                continue;
            }
            files.add(resolve(user, pageId, key.trim()));
        }
        return files;
    }

    public LibraryFile resolve(User user, String pageId, String key) {
        if (!StorageKeys.ownedBy(user, key)) {
            throw notFound();
        }
        ContentGenerationStore.LibraryEntry entry = store.findLibraryEntry(user.id(), pageId, false, key)
                .orElseThrow(LibraryFileResolver::notFound);
        String contentType = entry.contentType() != null ? entry.contentType() : MediaMetadata.contentTypeFor(key);
        byte[] bytes;
        try {
            bytes = storage.read(key);
        } catch (SdkException exception) {
            throw notFound();
        }
        MediaMetadata metadata = entry.metadata() != null && entry.metadata().sizeBytes() != null
                ? entry.metadata()
                : MediaMetadata.of(bytes, contentType);
        return new LibraryFile(key, MediaMetadata.fileName(key), contentType, bytes, metadata);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Library file not found");
    }
}
