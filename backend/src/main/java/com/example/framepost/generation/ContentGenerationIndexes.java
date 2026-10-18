package com.example.framepost.generation;

import org.bson.Document;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.stereotype.Component;

@Component
@Profile("!migrate-content-generations & !migrate-video-generations & !migrate-storage-keys & !migrate-content-media")
public class ContentGenerationIndexes implements ApplicationRunner {
    private final MongoTemplate mongo;

    public ContentGenerationIndexes(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public void run(ApplicationArguments args) {
        ensure(mongo);
    }

    public static void ensure(MongoTemplate mongo) {
        var indexes = mongo.indexOps(ContentGeneration.class);
        indexes.ensureIndex(new Index().on("userId", Direction.ASC).on("createdAt", Direction.DESC).named("content_user_created"));
        indexes.ensureIndex(new Index().on("userId", Direction.ASC).on("pageId", Direction.ASC)
                .on("createdAt", Direction.DESC).named("content_scope_created"));
        indexes.ensureIndex(new Index().on("userId", Direction.ASC).on("pageId", Direction.ASC)
                .on("provider", Direction.ASC).on("createdAt", Direction.DESC).named("content_provider_created"));
        indexes.ensureIndex(new Index().on("userId", Direction.ASC).on("pageId", Direction.ASC)
                .on("provider", Direction.ASC).on("workflowKey", Direction.ASC)
                .on("createdAt", Direction.DESC).named("content_workflow_created"));
        indexes.ensureIndex(new Index().on("parentGenerationId", Direction.ASC).named("content_parent"));
        indexes.ensureIndex(new Index().on("provider", Direction.ASC).on("providerMetadata.runningHubTaskId", Direction.ASC)
                .unique().partial(PartialIndexFilter.of(new Document("provider", "RUNNINGHUB")
                        .append("providerMetadata.runningHubTaskId", new Document("$type", "string"))))
                .named("content_provider_task"));

        var inputIndexes = mongo.indexOps(ContentInput.class);
        inputIndexes.ensureIndex(new Index().on("generationId", Direction.ASC).on("position", Direction.ASC)
                .named("content_input_generation_position"));
        inputIndexes.ensureIndex(new Index().on("userId", Direction.ASC).on("pageId", Direction.ASC)
                .on("createdAt", Direction.DESC).named("content_input_scope_created"));

        inputIndexes.ensureIndex(new Index().on("key", Direction.ASC).named("content_input_key"));

        var outputIndexes = mongo.indexOps(ContentOutput.class);
        outputIndexes.ensureIndex(new Index().on("generationId", Direction.ASC).on("position", Direction.ASC)
                .named("content_output_generation_position"));
        outputIndexes.ensureIndex(new Index().on("userId", Direction.ASC).on("pageId", Direction.ASC)
                .on("createdAt", Direction.DESC).named("content_output_scope_created"));
        outputIndexes.ensureIndex(new Index().on("key", Direction.ASC).named("content_output_key"));
    }
}