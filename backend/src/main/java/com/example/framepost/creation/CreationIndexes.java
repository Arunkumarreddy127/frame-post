package com.example.framepost.creation;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.stereotype.Component;

@Component
@Profile("!migrate-content-generations & !migrate-video-generations & !migrate-storage-keys & !migrate-content-media & !migrate-creation-lanes")
public class CreationIndexes implements ApplicationRunner {
    /** Old global unique index on generationId, which allowed a generation in only one creation. Dropped on startup. */
    private static final String LEGACY_GENERATION_INDEX = "creation_item_generation";

    private final MongoTemplate mongo;

    public CreationIndexes(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public void run(ApplicationArguments args) {
        ensure(mongo);
    }

    public static void ensure(MongoTemplate mongo) {
        var creations = mongo.indexOps(Creation.class);
        creations.ensureIndex(new Index().on("userId", Direction.ASC).on("pageId", Direction.ASC)
                .on("updatedAt", Direction.DESC).named("creation_scope_updated"));

        // One generation can sit in many creations, but only once in each. A unique (creationId, generationId) pair enforces that.
        var items = mongo.indexOps(CreationItem.class);
        for (IndexInfo index : items.getIndexInfo()) {
            if (LEGACY_GENERATION_INDEX.equals(index.getName())) {
                items.dropIndex(LEGACY_GENERATION_INDEX);
            }
        }
        items.ensureIndex(new Index().on("creationId", Direction.ASC).on("generationId", Direction.ASC).unique()
                .named("creation_item_creation_generation"));
        items.ensureIndex(new Index().on("creationId", Direction.ASC).on("position", Direction.ASC)
                .named("creation_item_position"));
        items.ensureIndex(new Index().on("shotId", Direction.ASC).on("position", Direction.ASC)
                .named("creation_item_shot_position"));

        mongo.indexOps(Scene.class).ensureIndex(new Index().on("creationId", Direction.ASC)
                .on("position", Direction.ASC).named("creation_scene_position"));
        mongo.indexOps(Shot.class).ensureIndex(new Index().on("sceneId", Direction.ASC)
                .on("position", Direction.ASC).named("creation_shot_scene_position"));
        mongo.indexOps(Shot.class).ensureIndex(new Index().on("creationId", Direction.ASC)
                .on("position", Direction.ASC).named("creation_shot_creation_position"));
    }
}
