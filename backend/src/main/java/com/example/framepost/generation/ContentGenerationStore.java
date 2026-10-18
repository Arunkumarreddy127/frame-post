package com.example.framepost.generation;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * Reads and writes a generation together with its input and output files. Without multi-document
 * transactions, files are written before the generation and deleted after it, so a generation never
 * points at files that do not exist.
 */
@Component
public class ContentGenerationStore {

    public record Hydrated(ContentGeneration generation, List<ContentInput> inputs, List<ContentOutput> outputs) {
    }

    /** Position in a newest-first listing: only items after it are returned. */
    public record Cursor(Instant createdAt, String id) {
        private static final char SEPARATOR = '|';

        public static Cursor parse(String raw) {
            if (raw == null || raw.isBlank()) {
                return null;
            }
            int separator = raw.indexOf(SEPARATOR);
            try {
                if (separator < 0) {
                    return new Cursor(Instant.parse(raw), null);
                }
                return new Cursor(Instant.parse(raw.substring(0, separator)), raw.substring(separator + 1));
            } catch (DateTimeParseException exception) {
                throw new IllegalArgumentException("Invalid cursor");
            }
        }

        public String encode() {
            return createdAt + String.valueOf(SEPARATOR) + id;
        }
    }

    private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "createdAt", "id");

    private final ContentGenerationRepository generationRepository;
    private final ContentInputRepository inputRepository;
    private final ContentOutputRepository outputRepository;
    private final MongoTemplate mongo;

    public ContentGenerationStore(
            ContentGenerationRepository generationRepository,
            ContentInputRepository inputRepository,
            ContentOutputRepository outputRepository,
            MongoTemplate mongo
    ) {
        this.generationRepository = generationRepository;
        this.inputRepository = inputRepository;
        this.outputRepository = outputRepository;
        this.mongo = mongo;
    }

    /** Stable ids let a generation that is saved repeatedly rewrite its files instead of duplicating them. */
    public static String inputId(String generationId, String slot) {
        return generationId + ":in:" + slot;
    }

    public static String outputId(String generationId, int position) {
        return generationId + ":out:" + position;
    }

    public void save(ContentGeneration generation, List<ContentInput> inputs, List<ContentOutput> outputs) {
        inputRepository.saveAll(inputs);
        outputRepository.saveAll(outputs);
        generationRepository.save(generation);
    }

    public void delete(String generationId) {
        generationRepository.deleteById(generationId);
        inputRepository.deleteByGenerationId(generationId);
        outputRepository.deleteByGenerationId(generationId);
    }

    public Optional<Hydrated> find(String generationId) {
        return generationRepository.findById(generationId).map(generation -> hydrate(List.of(generation)).getFirst());
    }

    /** Attaches files with two batch queries, however many generations there are. */
    public List<Hydrated> hydrate(List<ContentGeneration> generations) {
        if (generations.isEmpty()) {
            return List.of();
        }
        List<String> ids = generations.stream().map(ContentGeneration::id).toList();
        Map<String, List<ContentInput>> inputs = inputRepository.findByGenerationIdIn(ids).stream()
                .collect(Collectors.groupingBy(ContentInput::generationId));
        Map<String, List<ContentOutput>> outputs = outputRepository.findByGenerationIdIn(ids).stream()
                .collect(Collectors.groupingBy(ContentOutput::generationId));
        return generations.stream()
                .map(generation -> new Hydrated(
                        generation,
                        inputs.getOrDefault(generation.id(), List.of()).stream()
                                .sorted(Comparator.comparingInt(ContentInput::position)).toList(),
                        outputs.getOrDefault(generation.id(), List.of()).stream()
                                .sorted(Comparator.comparingInt(ContentOutput::position)).toList()))
                .toList();
    }

    /**
     * Newest-first generations for a user. A null {@code pageId} matches every scope unless
     * {@code globalOnly} restricts it to generations that belong to no page.
     */
    public List<ContentGeneration> queryGenerations(
            String userId, String pageId, boolean globalOnly, ContentGeneration.Provider provider,
            String workflowKey, Cursor cursor, int limit
    ) {
        List<Criteria> criteria = scope(userId, pageId, globalOnly);
        if (provider != null) {
            criteria.add(Criteria.where("provider").is(provider));
        }
        if (workflowKey != null && !workflowKey.isBlank()) {
            criteria.add(Criteria.where("workflowKey").is(workflowKey));
        }
        return mongo.find(build(criteria, cursor, limit), ContentGeneration.class);
    }

    /** Files that belong to a generation; inputs picked from the Library are references and are left out. */
    public List<ContentInput> queryInputs(String userId, String pageId, boolean globalOnly, Cursor cursor, int limit) {
        List<Criteria> criteria = scope(userId, pageId, globalOnly);
        criteria.add(Criteria.where("referenced").ne(true));
        return mongo.find(build(criteria, cursor, limit), ContentInput.class);
    }

    /** A Library file the user owns in the given scope: a stored input or output that is not itself a reference. */
    public Optional<LibraryEntry> findLibraryEntry(String userId, String pageId, boolean globalOnly, String key) {
        List<Criteria> criteria = scope(userId, pageId, globalOnly);
        criteria.add(Criteria.where("key").is(key));
        Query query = new Query(new Criteria().andOperator(criteria.toArray(new Criteria[0]))).limit(1);
        Query inputQuery = new Query(new Criteria().andOperator(
                Stream.concat(criteria.stream(), Stream.of(Criteria.where("referenced").ne(true)))
                        .toArray(Criteria[]::new))).limit(1);
        ContentOutput output = mongo.findOne(query, ContentOutput.class);
        if (output != null) {
            return Optional.of(new LibraryEntry(output.contentType(), output.name(), new MediaMetadata(
                    output.sizeBytes(), output.width(), output.height(), output.durationSeconds())));
        }
        ContentInput input = mongo.findOne(inputQuery, ContentInput.class);
        return Optional.ofNullable(input).map(row -> new LibraryEntry(row.contentType(), row.name(),
                new MediaMetadata(row.sizeBytes(), row.width(), row.height(), row.durationSeconds())));
    }

    public record LibraryEntry(String contentType, String name, MediaMetadata metadata) {
    }

    /** True when a generation other than {@code generationId} still uses the stored object. */
    public boolean isKeyUsedElsewhere(String key, String generationId) {
        Query query = new Query(new Criteria().andOperator(
                Criteria.where("key").is(key), Criteria.where("generationId").ne(generationId)));
        return mongo.exists(query, ContentInput.class) || mongo.exists(query, ContentOutput.class);
    }

    public List<ContentOutput> queryOutputs(String userId, String pageId, boolean globalOnly, Cursor cursor, int limit) {
        return mongo.find(build(scope(userId, pageId, globalOnly), cursor, limit), ContentOutput.class);
    }

    private static List<Criteria> scope(String userId, String pageId, boolean globalOnly) {
        List<Criteria> criteria = new ArrayList<>();
        criteria.add(Criteria.where("userId").is(userId));
        if (pageId != null) {
            criteria.add(Criteria.where("pageId").is(pageId));
        } else if (globalOnly) {
            criteria.add(Criteria.where("pageId").is(null));
        }
        return criteria;
    }

    private static Query build(List<Criteria> criteria, Cursor cursor, int limit) {
        if (cursor != null) {
            criteria.add(cursor.id() == null
                    ? Criteria.where("createdAt").lt(cursor.createdAt())
                    : new Criteria().orOperator(
                            Criteria.where("createdAt").lt(cursor.createdAt()),
                            new Criteria().andOperator(
                                    Criteria.where("createdAt").is(cursor.createdAt()),
                                    Criteria.where("id").lt(cursor.id()))));
        }
        return new Query(new Criteria().andOperator(criteria)).with(NEWEST_FIRST).limit(limit);
    }
}
