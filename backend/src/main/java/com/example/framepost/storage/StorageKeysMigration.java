package com.example.framepost.storage;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import com.example.framepost.auth.User;

/**
 * One-off move of legacy R2 objects into the {@code inputs/} and {@code outputs/} key layout. Runs only with the
 * {@code migrate-storage-keys} profile and exits when finished. Pass {@code --dry-run} to log planned moves without
 * changing anything. For each record: copy the object to its new key, update the Mongo references, then delete the
 * old object. Records without legacy keys are skipped, so re-runs are safe.
 */
@Component
@Profile("migrate-storage-keys")
class StorageKeysMigration implements ApplicationRunner {

    static final String IMAGE_COLLECTION = "image_generations";
    static final String RUNNINGHUB_COLLECTION = "runninghub_generations";
    static final String CONTENT_COLLECTION = "content_generations";
    static final String LEGACY_IMAGE_PREFIX = "image-generations/";
    static final String LEGACY_RUNNINGHUB_PREFIX = "runninghub-generations/";
    static final int BATCH_SIZE = 500;

    private static final Logger log = LoggerFactory.getLogger(StorageKeysMigration.class);

    private final MongoTemplate mongo;
    private final StorageService storage;
    private final ApplicationContext context;

    StorageKeysMigration(MongoTemplate mongo, StorageService storage, ApplicationContext context) {
        this.mongo = mongo;
        this.storage = storage;
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean dryRun = args.containsOption("dry-run");
        Result result = migrate(dryRun);
        log.info("storage key migration {}: read={}, migrated={}, failed={}",
                dryRun ? "(dry run)" : "finished", result.read(), result.migrated(), result.failed());
        System.exit(SpringApplication.exit(context));
    }

    Result migrate(boolean dryRun) {
        if (mongo.collectionExists(CONTENT_COLLECTION)) {
            return migrateCollection(CONTENT_COLLECTION, dryRun);
        }
        return migrateCollection(IMAGE_COLLECTION, dryRun)
                .plus(migrateCollection(RUNNINGHUB_COLLECTION, dryRun));
    }

    private Result migrateCollection(String collection, boolean dryRun) {
        int read = 0;
        int migrated = 0;
        int failed = 0;
        Object lastId = null;
        while (true) {
            Query query = new Query().with(Sort.by("_id")).limit(BATCH_SIZE);
            if (lastId != null) {
                query.addCriteria(Criteria.where("_id").gt(lastId));
            }
            List<Document> batch = mongo.find(query, Document.class, collection);
            if (batch.isEmpty()) {
                break;
            }
            lastId = batch.get(batch.size() - 1).get("_id");
            read += batch.size();
            for (Document doc : batch) {
                try {
                    if (migrateRecord(collection, doc, dryRun)) {
                        migrated++;
                    }
                } catch (RuntimeException e) {
                    failed++;
                    log.warn("Failed to migrate {} record {}: {}", collection, doc.get("_id"), e.getMessage());
                }
            }
        }
        return new Result(read, migrated, failed);
    }

    private boolean migrateRecord(String collection, Document doc, boolean dryRun) {
        boolean image = IMAGE_COLLECTION.equals(collection);
        boolean content = CONTENT_COLLECTION.equals(collection);
        Object id = doc.get("_id");
        String workflowKey = doc.getString("workflowKey");

        Map<String, String> moves = new LinkedHashMap<>();
        for (String key : content ? contentKeys(doc) : keysOf(image, doc)) {
            if (key == null || moves.containsKey(key)) {
                continue;
            }
            if (!isLegacy(key)) {
                continue;
            }
            User owner = mongo.findById(doc.getString("userId"), User.class);
            if (owner == null) {
                throw new IllegalStateException("owner not found for " + key);
            }
            String target = targetKey(key, owner, workflowKey)
                    .orElseThrow(() -> new IllegalStateException("unrecognized legacy key " + key));
            moves.put(key, target);
        }
        if (moves.isEmpty()) {
            return false;
        }

        if (dryRun) {
            moves.forEach((from, to) -> log.info("[dry run] {} -> {}", from, to));
            return true;
        }

        for (Map.Entry<String, String> move : moves.entrySet()) {
            storage.copy(move.getKey(), move.getValue());
        }

        Update update = content ? contentUpdate(doc, moves) : image ? imageUpdate(doc, moves) : runningHubUpdate(doc, moves);
        if (mongo.updateFirst(Query.query(Criteria.where("_id").is(id)), update, collection).getMatchedCount() != 1) {
            throw new IllegalStateException("Generation disappeared before storage references were updated");
        }
        for (Map.Entry<String, String> move : moves.entrySet()) {
            for (String targetCollection : List.of(IMAGE_COLLECTION, CONTENT_COLLECTION)) {
                mongo.updateMulti(Query.query(Criteria.where("parentResultKey").is(move.getKey())),
                        new Update().set("parentResultKey", move.getValue()), targetCollection);
            }
        }

        for (String oldKey : moves.keySet()) {
            storage.delete(oldKey);
        }
        return true;
    }

    private static List<String> keysOf(boolean image, Document doc) {
        List<String> keys = new ArrayList<>();
        if (image) {
            keys.addAll(doc.getList("inputKeys", String.class, List.of()));
            for (Document result : doc.getList("results", Document.class, List.of())) {
                keys.add(result.getString("key"));
            }
        } else {
            Document inputFileKeys = doc.get("inputFileKeys", Document.class);
            if (inputFileKeys != null) {
                for (Object value : inputFileKeys.values()) {
                    keys.add(value == null ? null : value.toString());
                }
            }
            keys.add(doc.getString("resultKey"));
        }
        return keys;
    }

    private static List<String> contentKeys(Document doc) {
        List<String> keys = new ArrayList<>();
        Document files = doc.get("inputFileKeys", Document.class);
        if (files != null) files.values().forEach(value -> { if (value != null) keys.add(value.toString()); });
        for (Document output : doc.getList("outputs", Document.class, List.of())) keys.add(output.getString("key"));
        return keys;
    }

    static Update contentUpdate(Document doc, Map<String, String> moves) {
        Document files = new Document();
        Document original = doc.get("inputFileKeys", Document.class);
        if (original != null) original.forEach((name, key) -> files.put(name,
                key == null ? null : moves.getOrDefault(key.toString(), key.toString())));
        List<Document> outputs = doc.getList("outputs", Document.class, List.of()).stream()
                .map(output -> new Document(output).append("key", moves.getOrDefault(output.getString("key"), output.getString("key"))))
                .toList();
        return new Update().set("inputFileKeys", files).set("outputs", outputs);
    }

    private static Update imageUpdate(Document doc, Map<String, String> moves) {
        List<String> inputKeys = doc.getList("inputKeys", String.class, List.of()).stream()
                .map(key -> moves.getOrDefault(key, key))
                .toList();
        List<Document> results = doc.getList("results", Document.class, List.of()).stream()
                .map(result -> new Document(result).append("key",
                        moves.getOrDefault(result.getString("key"), result.getString("key"))))
                .toList();
        return new Update().set("inputKeys", inputKeys).set("results", results);
    }

    private static Update runningHubUpdate(Document doc, Map<String, String> moves) {
        Update update = new Update();
        Document inputFileKeys = doc.get("inputFileKeys", Document.class);
        if (inputFileKeys != null) {
            Document mapped = new Document();
            inputFileKeys.forEach((name, key) ->
                    mapped.append(name, key == null ? null : moves.getOrDefault(key.toString(), key.toString())));
            update.set("inputFileKeys", mapped);
        }
        String resultKey = doc.getString("resultKey");
        if (resultKey != null) {
            update.set("resultKey", moves.getOrDefault(resultKey, resultKey));
        }
        return update;
    }

    private static boolean isLegacy(String key) {
        return key.startsWith(LEGACY_IMAGE_PREFIX) || key.startsWith(LEGACY_RUNNINGHUB_PREFIX);
    }

    /**
     * Maps a legacy key to its new location. Legacy image inputs {@code inputs/N.ext} become
     * {@code input-N.ext} and outputs {@code N.ext} become {@code output-N.ext}. RunningHub inputs sit at the record
     * root as {@code name.ext} and keep their name, while the output {@code output.ext} becomes
     * {@code {workflowKey}-output.ext}.
     */
    static Optional<String> targetKey(String legacyKey, User owner, String workflowKey) {
        boolean image;
        String rest;
        if (legacyKey.startsWith(LEGACY_IMAGE_PREFIX)) {
            image = true;
            rest = legacyKey.substring(LEGACY_IMAGE_PREFIX.length());
        } else if (legacyKey.startsWith(LEGACY_RUNNINGHUB_PREFIX)) {
            image = false;
            rest = legacyKey.substring(LEGACY_RUNNINGHUB_PREFIX.length());
        } else {
            return Optional.empty();
        }

        String[] parts = rest.split("/", 3);
        if (parts.length != 3) {
            return Optional.empty();
        }
        String id = parts[1];
        String file = parts[2];

        boolean input;
        if (image) {
            input = file.startsWith("inputs/");
            if (input) {
                file = file.substring("inputs/".length());
            }
        } else {
            input = !file.startsWith("output.");
        }
        int dot = file.lastIndexOf('.');
        if (dot <= 0) {
            return Optional.empty();
        }
        String stem = file.substring(0, dot);
        String extension = file.substring(dot + 1);

        String name;
        if (input) {
            name = image ? "input-" + stem : stem;
        } else {
            name = image ? "output-" + stem : (workflowKey == null ? "output" : workflowKey + "-output");
        }
        String prefix = input ? StorageKeys.inputPrefix(owner, id) : StorageKeys.outputPrefix(owner, id);
        return Optional.of(prefix + name + "." + extension);
    }

    record Result(int read, int migrated, int failed) {

        Result plus(Result other) {
            return new Result(read + other.read, migrated + other.migrated, failed + other.failed);
        }
    }
}
