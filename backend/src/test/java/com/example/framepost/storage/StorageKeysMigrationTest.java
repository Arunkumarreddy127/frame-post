package com.example.framepost.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.Optional;
import java.util.List;
import java.util.Map;
import org.bson.Document;

import com.example.framepost.auth.User;
import org.junit.jupiter.api.Test;

class StorageKeysMigrationTest {

    private final User owner = new User("u1", "Jane Doe", "hash", Instant.now());

    @Test
    void mapsLegacyImageInputsAndOutputs() {
        assertEquals(Optional.of("inputs/jane-doe-u1/gen-1/input-1.png"),
                StorageKeysMigration.targetKey("image-generations/u1/gen-1/inputs/1.png", owner, null));
        assertEquals(Optional.of("outputs/jane-doe-u1/gen-1/output-2.png"),
                StorageKeysMigration.targetKey("image-generations/u1/gen-1/2.png", owner, null));
    }

    @Test
    void mapsLegacyRunningHubInputsKeepingNameAndOutputsUsingWorkflowKey() {
        assertEquals(Optional.of("inputs/jane-doe-u1/rh-1/image.jpg"),
                StorageKeysMigration.targetKey("runninghub-generations/u1/rh-1/image.jpg", owner, "wf"));
        assertEquals(Optional.of("outputs/jane-doe-u1/rh-1/wf-output.mp4"),
                StorageKeysMigration.targetKey("runninghub-generations/u1/rh-1/output.mp4", owner, "wf"));
    }

    @Test
        void updatesSharedAssetsWithoutDroppingOutputMetadata() {
        Document source = new Document("inputFileKeys", new Document("attachment-1", "old-input.png"))
            .append("outputs", List.of(new Document("key", "old-output.png")
                .append("type", "image").append("contentType", "image/png")));
        Document fields = StorageKeysMigration.contentUpdate(source,
            Map.of("old-input.png", "new-input.png", "old-output.png", "new-output.png"))
            .getUpdateObject().get("$set", Document.class);
        assertEquals("new-input.png", fields.get("inputFileKeys", Document.class).getString("attachment-1"));
        assertEquals(new Document("key", "new-output.png").append("type", "image").append("contentType", "image/png"),
            fields.getList("outputs", Document.class).getFirst());
        }

        @Test
    void ignoresKeysAlreadyInNewLayoutOrUnrecognized() {
        assertTrue(StorageKeysMigration.targetKey("inputs/jane-doe-u1/gen-1/input-1.png", owner, null).isEmpty());
        assertTrue(StorageKeysMigration.targetKey("image-generations/u1/gen-1", owner, null).isEmpty());
        assertTrue(StorageKeysMigration.targetKey("other/u1/gen-1/1.png", owner, null).isEmpty());
    }
}
