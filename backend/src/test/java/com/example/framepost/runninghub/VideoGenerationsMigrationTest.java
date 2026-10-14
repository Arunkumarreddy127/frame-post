package com.example.framepost.runninghub;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.context.ApplicationContext;

class VideoGenerationsMigrationTest {

    private static Document legacy(String id, String resultKey) {
        return new Document("_id", id)
                .append("userId", "user-1")
                .append("pageId", "page-1")
                .append("prompt", "a cat")
                .append("inputKey", "in/" + id + ".png")
                .append("resultKey", resultKey)
                .append("runningHubTaskId", "task-" + id)
                .append("status", "COMPLETED")
                .append("error", null)
                .append("createdAt", "2025-01-01");
    }

    @Test
    void mapsLegacyRecordToGenericShape() {
        Document mapped = VideoGenerationsMigration.map(legacy("a", "out/a.mp4"));

        assertThat(mapped.get("_id")).isEqualTo("a");
        assertThat(mapped.get("workflowKey")).isEqualTo("minimax-h3-ff-image-to-video");
        assertThat(mapped.get("inputs")).isEqualTo(new Document("prompt", "a cat"));
        assertThat(mapped.get("inputFileKeys")).isEqualTo(new Document("image", "in/a.png"));
        assertThat(mapped.get("resultKey")).isEqualTo("out/a.mp4");
        assertThat(mapped.get("resultType")).isEqualTo("video");
        assertThat(mapped.get("resultContentType")).isEqualTo("video/mp4");
        assertThat(mapped.get("runningHubTaskId")).isEqualTo("task-a");
        assertThat(mapped.get("status")).isEqualTo("COMPLETED");
    }

    @Test
    void failedRecordWithoutResultHasNoResultFields() {
        Document mapped = VideoGenerationsMigration.map(legacy("b", null));

        assertThat(mapped.get("resultKey")).isNull();
        assertThat(mapped.get("resultType")).isNull();
        assertThat(mapped.get("resultContentType")).isNull();
    }

    @Test
    void dryRunCountsWithoutWriting() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        when(mongo.find(any(Query.class), eq(Document.class), eq(VideoGenerationsMigration.SOURCE)))
                .thenReturn(List.of(legacy("a", "out/a.mp4"), legacy("b", null)), List.of());
        when(mongo.find(any(Query.class), eq(Document.class), eq(VideoGenerationsMigration.TARGET)))
                .thenReturn(List.of());

        VideoGenerationsMigration.Result result = migrator(mongo).migrate(true);

        assertThat(result).isEqualTo(new VideoGenerationsMigration.Result(2, 2, 0, 0));
        verify(mongo, never()).insert(any(Document.class), anyString());
    }

    @Test
    void skipsExistingRecordsAndInsertsTheRest() {
        MongoTemplate mongo = mock(MongoTemplate.class);
        when(mongo.find(any(Query.class), eq(Document.class), eq(VideoGenerationsMigration.SOURCE)))
                .thenReturn(List.of(legacy("a", "out/a.mp4"), legacy("b", null)), List.of());
        when(mongo.find(any(Query.class), eq(Document.class), eq(VideoGenerationsMigration.TARGET)))
                .thenReturn(List.of(new Document("_id", "a")));

        VideoGenerationsMigration.Result result = migrator(mongo).migrate(false);

        assertThat(result).isEqualTo(new VideoGenerationsMigration.Result(2, 1, 1, 0));
        verify(mongo).insert(any(Document.class), eq(VideoGenerationsMigration.TARGET));
    }

    private static VideoGenerationsMigration migrator(MongoTemplate mongo) {
        return new VideoGenerationsMigration(mongo, mock(ApplicationContext.class));
    }
}
