package com.example.framepost.generation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Date;
import java.util.List;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import com.example.framepost.image.ImageGenerationRepository;
import com.example.framepost.runninghub.RunningHubGenerationRepository;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;

@EnabledIfEnvironmentVariable(named = "CONTENT_MIGRATION_TEST_URI", matches = ".+")
class ContentGenerationsMigrationTest {
    private MongoClient client;
    private MongoTemplate mongo;
    private ContentGenerationsMigration migration;

    @BeforeEach
    void setUp() {
        client = MongoClients.create(System.getenv("CONTENT_MIGRATION_TEST_URI"));
        mongo = new MongoTemplate(client, "content_migration_test_" + new ObjectId());
        migration = new ContentGenerationsMigration(mongo, null, null);
    }

    @AfterEach
    void tearDown() {
        mongo.getDb().drop();
        client.close();
    }

    @Test
    void migratesBothProvidersPreservingBsonAndQueriesAndRerunsWithoutWrites() {
        Document image = image(new ObjectId());
        Document video = video("video-id");
        mongo.getCollection("image_generations").insertOne(image);
        mongo.getCollection("runninghub_generations").insertOne(video);
        assertThat(migration.migrate(true, false).read()).isEqualTo(2);
        assertThat(mongo.getCollection("content_generations").countDocuments()).isZero();
        assertThat(migration.migrate(false, false)).isEqualTo(new ContentGenerationsMigration.Result(2, 2, 0, 2));
        assertThat(migration.migrate(false, false)).isEqualTo(new ContentGenerationsMigration.Result(2, 0, 2, 2));
        assertThat(migration.migrate(false, true).verified()).isEqualTo(2);
        assertThat(mongo.getCollection("image_generations").find().first()).isEqualTo(image);
        assertThat(mongo.getCollection("runninghub_generations").find().first()).isEqualTo(video);
        ContentGenerationRepository repository = new MongoRepositoryFactory(mongo).getRepository(ContentGenerationRepository.class);
        assertThat(repository.findByUserIdOrderByCreatedAtDesc("owner")).hasSize(2);
        assertThat(repository.findByProviderAndUserIdAndPageIdOrderByCreatedAtDesc(ContentGeneration.Provider.OPENAI, "owner", null))
                .singleElement().satisfies(content -> {
                    assertThat(content.toImage().imageCount()).isEqualTo(2);
                    assertThat(content.toImage().parentResultKey()).isEqualTo("parent.png");
                    assertThat(content.toImage().inputKeys()).containsExactly("first.png", "second.png");
                });
        assertThat(repository.findByProviderAndProviderMetadataRunningHubTaskId(ContentGeneration.Provider.RUNNINGHUB, "task"))
                .isPresent();
        assertThat(repository.findByProviderAndProviderMetadataRunningHubTaskId(ContentGeneration.Provider.OPENAI, "task"))
                .isEmpty();
        assertThat(repository.findByProviderAndId(ContentGeneration.Provider.OPENAI, "video-id")).isEmpty();
        assertThat(repository.findByUserIdAndPageIdOrderByCreatedAtDesc("owner", "page")).hasSize(1);
        repository.deleteByProviderAndId(ContentGeneration.Provider.OPENAI, "video-id");
        assertThat(repository.findById("video-id")).isPresent();
    }

    @Test
    void providerAdaptersWriteOnlyToSharedCollectionAndKeepScopesSeparate() {
        ContentGenerationRepository repository = new MongoRepositoryFactory(mongo).getRepository(ContentGenerationRepository.class);
        ImageGenerationRepository images = new ImageGenerationRepository(repository);
        RunningHubGenerationRepository videos = new RunningHubGenerationRepository(repository, null);
        var image = mongo.getConverter().read(com.example.framepost.image.ImageGeneration.class, image("new-image"));
        var video = mongo.getConverter().read(com.example.framepost.runninghub.RunningHubGeneration.class, video("new-video"));
        assertThat(images.save(image)).isEqualTo(image);
        assertThat(videos.save(video)).isEqualTo(video);
        assertThat(mongo.getCollection("image_generations").countDocuments()).isZero();
        assertThat(mongo.getCollection("runninghub_generations").countDocuments()).isZero();
        assertThat(mongo.getCollection("content_generations").countDocuments()).isEqualTo(2);
        assertThat(images.findByIdAndUserIdAndPageId("new-video", "owner", "page")).isEmpty();
        assertThat(videos.findById("new-image")).isEmpty();
        assertThat(videos.findByRunningHubTaskId("task")).isPresent();
        images.delete(image);
        assertThat(mongo.getCollection("content_generations").countDocuments()).isEqualTo(1);
    }

    @Test
    void rejectsCrossSourceCollisionsBeforeAnyWrite() {
        mongo.getCollection("image_generations").insertOne(image("same"));
        mongo.getCollection("runninghub_generations").insertOne(video("same"));
        assertThatThrownBy(() -> migration.migrate(false, false)).hasMessageContaining("both source");
        assertThat(mongo.getCollection("content_generations").countDocuments()).isZero();
    }

    @Test
    void rejectsProcessingConflictsDuplicateTasksAndUnexpectedTargetRecords() {
        mongo.getCollection("runninghub_generations").insertOne(video("video").append("status", "PROCESSING"));
        assertThatThrownBy(() -> migration.migrate(true, false)).hasMessageContaining("Active generation");
        mongo.getCollection("runninghub_generations").deleteMany(new Document());
        mongo.getCollection("runninghub_generations").insertMany(List.of(video("one"), video("two")));
        assertThatThrownBy(() -> migration.migrate(true, false)).hasMessageContaining("Duplicate RunningHub task");
        mongo.getCollection("runninghub_generations").deleteMany(new Document());
        mongo.getCollection("image_generations").insertOne(image("image"));
        assertThatThrownBy(() -> migration.migrate(false, true)).hasMessageContaining("Missing target");
        migration.migrate(false, false);
        mongo.getCollection("content_generations").updateOne(new Document("_id", "image"),
                new Document("$set", new Document("error", "changed")));
        assertThatThrownBy(() -> migration.migrate(false, false)).hasMessageContaining("conflicts");
        mongo.getCollection("content_generations").deleteMany(new Document());
        mongo.getCollection("content_generations").insertOne(new Document("_id", "unknown"));
        assertThatThrownBy(() -> migration.migrate(true, false)).hasMessageContaining("Unexpected target");
    }

    @Test
    void scansMoreThanOneBatchAndPreservesHexStringIdType() {
        List<Document> images = java.util.stream.IntStream.range(0, 501)
                .mapToObj(index -> image("image-" + index)).toList();
        mongo.getCollection("image_generations").insertMany(images);
        String hexId = new ObjectId().toHexString();
        mongo.getCollection("image_generations").insertOne(image(hexId));
        assertThat(migration.migrate(false, false).verified()).isEqualTo(502);
        assertThat(mongo.getCollection("content_generations").find(new Document("_id", hexId)).first()).isNotNull();
    }

    private Document image(Object id) {
        return new Document("_id", id).append("userId", "owner").append("createdAt", Date.from(Instant.now()))
                .append("status", "COMPLETED").append("prompt", "prompt").append("model", "model")
                .append("size", "auto").append("quality", "high").append("imageCount", 2).append("outputFormat", "png")
                .append("inputKeys", List.of("first.png", "second.png"))
                .append("results", List.of(new Document("key", "output.png")))
                .append("parentGenerationId", "deleted-parent").append("parentResultKey", "parent.png");
    }

    private Document video(String id) {
        return new Document("_id", id).append("userId", "owner").append("pageId", "page")
                .append("createdAt", Date.from(Instant.now())).append("workflowKey", "video-workflow")
                .append("status", "COMPLETED").append("inputs", new Document("seconds", "8"))
                .append("inputFileKeys", new Document("image", "frame.png"))
                .append("resultKey", "output.mp4").append("resultType", "video").append("resultContentType", "video/mp4")
                .append("runningHubTaskId", "task").append("instanceType", "plus");
    }
}