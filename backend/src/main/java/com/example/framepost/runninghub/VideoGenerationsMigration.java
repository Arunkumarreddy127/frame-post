package com.example.framepost.runninghub;

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
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * One-off copy of legacy Minimax records from {@code video_generations} into {@code runninghub_generations}.
 * Runs only with the {@code migrate-video-generations} profile and exits when finished. Pass
 * {@code --dry-run} to count without writing. The source collection is never modified. Re-runs skip
 * records that already exist in the target.
 */
@Component
@Profile("migrate-video-generations")
class VideoGenerationsMigration implements ApplicationRunner {

    static final String SOURCE = "video_generations";
    static final String TARGET = "runninghub_generations";
    static final String WORKFLOW_KEY = "minimax-h3-ff-image-to-video";
    static final String INPUT_FILE_NAME = "image";
    static final String RESULT_TYPE = "video";
    static final String RESULT_CONTENT_TYPE = "video/mp4";
    static final int BATCH_SIZE = 500;

    private static final Logger log = LoggerFactory.getLogger(VideoGenerationsMigration.class);

    private final MongoTemplate mongo;
    private final ApplicationContext context;

    VideoGenerationsMigration(MongoTemplate mongo, ApplicationContext context) {
        this.mongo = mongo;
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean dryRun = args.containsOption("dry-run");
        Result result = migrate(dryRun);
        log.info("video_generations migration {}: read={}, {}={}, skipped={}, failed={}",
                dryRun ? "(dry run)" : "finished", result.read(), dryRun ? "wouldInsert" : "inserted",
                result.inserted(), result.skipped(), result.failed());
        System.exit(SpringApplication.exit(context));
    }

    Result migrate(boolean dryRun) {
        int read = 0;
        int inserted = 0;
        int skipped = 0;
        int failed = 0;
        Object lastId = null;
        while (true) {
            Query query = new Query().with(Sort.by("_id")).limit(BATCH_SIZE);
            if (lastId != null) {
                query.addCriteria(Criteria.where("_id").gt(lastId));
            }
            List<Document> batch = mongo.find(query, Document.class, SOURCE);
            if (batch.isEmpty()) {
                break;
            }
            lastId = batch.get(batch.size() - 1).get("_id");
            read += batch.size();

            List<Document> mapped = batch.stream().map(VideoGenerationsMigration::map).toList();
            Set<Object> existing = existingIds(mapped);
            for (Document doc : mapped) {
                if (existing.contains(doc.get("_id"))) {
                    skipped++;
                    continue;
                }
                if (dryRun) {
                    inserted++;
                    continue;
                }
                try {
                    mongo.insert(doc, TARGET);
                    inserted++;
                } catch (DuplicateKeyException duplicate) {
                    skipped++;
                } catch (RuntimeException e) {
                    failed++;
                    log.warn("Failed to migrate record {}: {}", doc.get("_id"), e.getMessage());
                }
            }
        }
        return new Result(read, inserted, skipped, failed);
    }

    static Document map(Document source) {
        Object prompt = source.get("prompt");
        Object inputKey = source.get("inputKey");
        Object resultKey = source.get("resultKey");

        Document inputs = new Document();
        if (prompt != null) {
            inputs.append("prompt", prompt);
        }
        Document inputFileKeys = new Document();
        if (inputKey != null) {
            inputFileKeys.append(INPUT_FILE_NAME, inputKey);
        }

        return new Document("_id", source.get("_id"))
                .append("userId", source.get("userId"))
                .append("pageId", source.get("pageId"))
                .append("workflowKey", WORKFLOW_KEY)
                .append("inputs", inputs)
                .append("inputFileKeys", inputFileKeys)
                .append("resultKey", resultKey)
                .append("resultType", resultKey == null ? null : RESULT_TYPE)
                .append("resultContentType", resultKey == null ? null : RESULT_CONTENT_TYPE)
                .append("runningHubTaskId", source.get("runningHubTaskId"))
                .append("status", source.get("status"))
                .append("error", source.get("error"))
                .append("createdAt", source.get("createdAt"));
    }

    private Set<Object> existingIds(List<Document> mapped) {
        List<Object> ids = mapped.stream().map(doc -> doc.get("_id")).toList();
        Query query = Query.query(Criteria.where("_id").in(ids));
        query.fields().include("_id");
        Set<Object> found = new HashSet<>();
        mongo.find(query, Document.class, TARGET).forEach(doc -> found.add(doc.get("_id")));
        return found;
    }

    record Result(int read, int inserted, int skipped, int failed) {
    }
}
