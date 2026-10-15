package com.example.framepost.generation;

import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

import com.example.framepost.image.ImageGeneration;
import com.example.framepost.runninghub.RunningHubGeneration;
import com.example.framepost.runninghub.WorkflowRegistry;
import com.mongodb.client.model.Filters;

@Component
@Profile("migrate-content-generations")
public class ContentGenerationsMigration implements ApplicationRunner {
    static final String TARGET = "content_generations";
    static final List<String> SOURCES = List.of("image_generations", "runninghub_generations");
    private static final Logger log = LoggerFactory.getLogger(ContentGenerationsMigration.class);
    private final MongoTemplate mongo;
    private final WorkflowRegistry workflows;
    private final ApplicationContext context;

    public ContentGenerationsMigration(MongoTemplate mongo, WorkflowRegistry workflows, ApplicationContext context) {
        this.mongo = mongo;
        this.workflows = workflows;
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean dryRun = args.containsOption("dry-run");
        boolean verifyOnly = args.containsOption("verify-only");
        if (dryRun && verifyOnly) throw new IllegalArgumentException("Choose dry-run or verify-only, not both");
        Result result = migrate(dryRun, verifyOnly);
        log.info("Content migration: read={}, inserted={}, identical={}, verified={}, dryRun={}, verifyOnly={}",
                result.read(), result.inserted(), result.identical(), result.verified(), dryRun, verifyOnly);
        SpringApplication.exit(context);
    }

    public Result migrate(boolean dryRun, boolean verifyOnly) {
        Set<Object> sourceIds = new HashSet<>();
        Set<String> taskIds = new HashSet<>();
        int identical = 0;
        for (String source : SOURCES) {
            try (var cursor = mongo.getCollection(source).find().batchSize(500).iterator()) {
                while (cursor.hasNext()) {
                    Document mapped = map(source, cursor.next());
                    Object id = mapped.get("_id");
                    if (!sourceIds.add(id)) throw invalid(id, "ID exists in both source collections");
                    Document metadata = mapped.get("providerMetadata", Document.class);
                    String taskId = metadata == null ? null : metadata.getString("runningHubTaskId");
                    if (taskId != null && !taskIds.add(taskId)) throw invalid(id, "Duplicate RunningHub task ID");
                    Document existing = target(id);
                    if (existing != null) {
                        requireEqual(mapped, existing);
                        identical++;
                    } else if (verifyOnly) {
                        throw invalid(id, "Missing target record");
                    }
                }
            }
        }
        try (var cursor = mongo.getCollection(TARGET).find().projection(new Document("_id", 1)).iterator()) {
            while (cursor.hasNext()) {
                Object id = cursor.next().get("_id");
                if (!sourceIds.contains(id)) throw invalid(id, "Unexpected target record; stopped to avoid merging live data");
            }
        }
        auditLineage(sourceIds);
        if (dryRun) return new Result(sourceIds.size(), 0, identical, 0);
        int inserted = 0;
        if (!verifyOnly) {
            for (String source : SOURCES) {
                try (var cursor = mongo.getCollection(source).find().batchSize(500).iterator()) {
                    while (cursor.hasNext()) {
                        Document mapped = map(source, cursor.next());
                        Document existing = target(mapped.get("_id"));
                        if (existing == null) {
                            mongo.getCollection(TARGET).insertOne(mapped);
                            inserted++;
                        } else {
                            requireEqual(mapped, existing);
                        }
                    }
                }
            }
        }
        int verified = 0;
        for (String source : SOURCES) {
            try (var cursor = mongo.getCollection(source).find().batchSize(500).iterator()) {
                while (cursor.hasNext()) {
                    Document mapped = map(source, cursor.next());
                    Document actual = target(mapped.get("_id"));
                    requireEqual(mapped, actual);
                    ContentGeneration content = mongo.getConverter().read(ContentGeneration.class, actual);
                    if (content.provider() == ContentGeneration.Provider.OPENAI) content.toImage();
                    else content.toRunningHub();
                    verified++;
                }
            }
        }
        if (mongo.getCollection(TARGET).countDocuments() != verified) {
            throw new IllegalStateException("Target count changed during verification; stop all backend writers");
        }
        if (!verifyOnly) ContentGenerationIndexes.ensure(mongo);
        for (String provider : List.of("OPENAI", "RUNNINGHUB")) {
            for (String status : List.of("PROCESSING", "COMPLETED", "FAILED")) {
                long count = mongo.getCollection(TARGET).countDocuments(new Document("provider", provider).append("status", status));
                log.info("Verified provider={} status={} count={}", provider, status, count);
            }
        }
        return new Result(sourceIds.size(), inserted, identical, verified);
    }

    private void auditLineage(Set<Object> sourceIds) {
        try (var cursor = mongo.getCollection("image_generations").find().batchSize(500).iterator()) {
            while (cursor.hasNext()) {
                Document source = cursor.next();
                Object parentId = source.get("parentGenerationId");
                if (parentId == null) continue;
                Object bsonParent = parentId instanceof String value && ObjectId.isValid(value) ? new ObjectId(value) : parentId;
                Document parent = mongo.getCollection("image_generations").find(Filters.eq("_id", bsonParent)).first();
                if (parent == null || !sourceIds.contains(parent.get("_id"))) {
                    log.warn("Preserving existing dangling parent reference for generation {}", source.get("_id"));
                }
            }
        }
    }

    Document map(String collection, Document source) {
        Object id = source.get("_id");
        if (!(id instanceof String) && !(id instanceof ObjectId)) throw invalid(id, "Unsupported BSON ID type");
        if (!(source.get("userId") instanceof String owner) || owner.isBlank()) throw invalid(id, "Missing userId");
        if (!(source.get("createdAt") instanceof Date)) throw invalid(id, "Invalid createdAt");
        if (source.get("pageId") != null && !(source.get("pageId") instanceof String)) throw invalid(id, "Invalid pageId");
        if (!Set.of("PROCESSING", "COMPLETED", "FAILED").contains(String.valueOf(source.get("status")))) {
            throw invalid(id, "Invalid status");
        }
        if ("PROCESSING".equals(source.getString("status"))) throw invalid(id, "Active generation; drain jobs before migration");
        Document clean = new Document(source);
        clean.remove("_class");
        ContentGeneration content;
        if ("image_generations".equals(collection)) {
            ImageGeneration image = mongo.getConverter().read(ImageGeneration.class, clean);
            if (image.imageCount() < 1) throw invalid(id, "Invalid imageCount");
            content = ContentGeneration.fromImage(image);
        } else if ("runninghub_generations".equals(collection)) {
            RunningHubGeneration generation = mongo.getConverter().read(RunningHubGeneration.class, clean);
            String type = generation.resultType();
            if (type == null) type = workflows.find(generation.workflowKey())
                    .orElseThrow(() -> invalid(id, "Unknown workflow output type")).output().type();
            content = ContentGeneration.fromRunningHub(generation, type);
        } else {
            throw new IllegalArgumentException("Unsupported source collection");
        }
        Document mapped = new Document();
        mongo.getConverter().write(content, mapped);
        mapped.put("_id", id);
        mapped.remove("_class");
        return mapped;
    }

    private Document target(Object id) {
        return mongo.getCollection(TARGET).find(Filters.eq("_id", id)).first();
    }

    static void requireEqual(Document expected, Document actual) {
        if (actual == null) throw invalid(expected.get("_id"), "Missing target record");
        Document comparable = new Document(actual);
        comparable.remove("_class");
        if (!expected.equals(comparable)) throw invalid(expected.get("_id"), "Target conflicts with source mapping");
    }

    private static IllegalStateException invalid(Object id, String reason) {
        return new IllegalStateException("Generation " + id + ": " + reason);
    }

    public record Result(int read, int inserted, int identical, int verified) {}
}