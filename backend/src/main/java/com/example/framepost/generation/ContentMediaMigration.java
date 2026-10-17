package com.example.framepost.generation;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

import com.mongodb.client.model.Filters;

@Component
@Profile("migrate-content-media")
public class ContentMediaMigration implements ApplicationRunner {
    static final String GENERATIONS_COLLECTION = "content_generations";
    static final String INPUTS_COLLECTION = "content_inputs";
    static final String OUTPUTS_COLLECTION = "content_outputs";
    private static final Logger log = LoggerFactory.getLogger(ContentMediaMigration.class);
    private final MongoTemplate mongo;
    private final ApplicationContext context;

    public ContentMediaMigration(MongoTemplate mongo, ApplicationContext context) {
        this.mongo = mongo;
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean dryRun = args.containsOption("dry-run");
        boolean verifyOnly = args.containsOption("verify-only");
        if (dryRun && verifyOnly) throw new IllegalArgumentException("Choose dry-run or verify-only, not both");
        Result result = migrate(dryRun, verifyOnly);
        log.info("Content media migration: read={}, migrated={}, unchanged={}, verified={}, dryRun={}, verifyOnly={}",
                result.read(), result.migrated(), result.unchanged(), result.verified(), dryRun, verifyOnly);
        SpringApplication.exit(context);
    }

    public Result migrate(boolean dryRun, boolean verifyOnly) {
        int read = 0;
        int migrated = 0;
        int unchanged = 0;
        int verified = 0;

        try (var cursor = mongo.getCollection(GENERATIONS_COLLECTION).find().batchSize(500).iterator()) {
            while (cursor.hasNext()) {
                Document doc = cursor.next();
                read++;
                int schemaVersion = doc.getInteger("schemaVersion", 1);

                if (schemaVersion == 2) {
                    // Already migrated
                    unchanged++;
                    continue;
                }

                if (verifyOnly) {
                    verified++;
                    continue;
                }

                // Convert v1 to v2
                String genId = doc.getString("_id");
                String userId = doc.getString("userId");
                String pageId = doc.getString("pageId");
                String provider = doc.getString("provider");

                // Extract inputs
                Document inputFileKeys = doc.get("inputFileKeys", Document.class);
                List<String> inputIds = new ArrayList<>();
                if (inputFileKeys != null) {
                    int position = 0;
                    for (String slot : inputFileKeys.keySet()) {
                        String key = inputFileKeys.getString(slot);
                        if (key != null) {
                            String inputId = java.util.UUID.randomUUID().toString();
                            inputIds.add(inputId);
                            Document inputDoc = new Document()
                                    .append("_id", inputId)
                                    .append("generationId", genId)
                                    .append("userId", userId)
                                    .append("pageId", pageId)
                                    .append("slot", slot)
                                    .append("position", position++)
                                    .append("key", key)
                                    .append("url", "") // Will be populated later or left for backward compat
                                    .append("name", key.substring(key.lastIndexOf('/') + 1))
                                    .append("contentType", MediaMetadata.contentTypeFor(key))
                                    .append("mediaType", MediaMetadata.mediaTypeFor(MediaMetadata.contentTypeFor(key)))
                                    .append("sizeBytes", null)
                                    .append("width", null)
                                    .append("height", null)
                                    .append("durationSeconds", null)
                                    .append("createdAt", doc.get("createdAt"));
                            if (!dryRun) {
                                mongo.getCollection(INPUTS_COLLECTION).insertOne(inputDoc);
                            }
                        }
                    }
                }

                // Extract outputs
                List<Document> outputs = doc.getList("outputs", Document.class);
                List<String> outputIds = new ArrayList<>();
                if (outputs != null) {
                    int position = 0;
                    for (Document output : outputs) {
                        String key = output.getString("key");
                        if (key != null) {
                            String outputId = java.util.UUID.randomUUID().toString();
                            outputIds.add(outputId);
                            Document outputDoc = new Document()
                                    .append("_id", outputId)
                                    .append("generationId", genId)
                                    .append("userId", userId)
                                    .append("pageId", pageId)
                                    .append("type", output.getString("type"))
                                    .append("position", position++)
                                    .append("key", key)
                                    .append("url", "")
                                    .append("name", key.substring(key.lastIndexOf('/') + 1))
                                    .append("contentType", output.getString("contentType") != null
                                            ? output.getString("contentType") : MediaMetadata.contentTypeFor(key))
                                    .append("mediaType", output.getString("type"))
                                    .append("sizeBytes", null)
                                    .append("width", null)
                                    .append("height", null)
                                    .append("durationSeconds", null)
                                    .append("createdAt", doc.get("createdAt"));
                            if (!dryRun) {
                                mongo.getCollection(OUTPUTS_COLLECTION).insertOne(outputDoc);
                            }
                        }
                    }
                }

                // Update generation
                if (!dryRun) {
                    mongo.getCollection(GENERATIONS_COLLECTION).updateOne(
                            Filters.eq("_id", genId),
                            new org.bson.Document("$set", new org.bson.Document()
                                    .append("schemaVersion", 2)
                                    .append("inputIds", inputIds)
                                    .append("outputIds", outputIds))
                            .append("$unset", new org.bson.Document()
                                    .append("inputFileKeys", "")
                                    .append("outputs", ""))
                    );
                }
                migrated++;
            }
        }

        return new Result(read, migrated, unchanged, verified);
    }

    public record Result(int read, int migrated, int unchanged, int verified) {
    }
}
