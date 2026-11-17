package com.example.framepost.creation;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
@Profile("!migrate-content-generations & !migrate-video-generations & !migrate-storage-keys & !migrate-content-media")
public class CreationIndexes implements ApplicationRunner {
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

        // A unique generationId is what enforces "one generation, one creation".
        var items = mongo.indexOps(CreationItem.class);
        items.ensureIndex(new Index().on("generationId", Direction.ASC).unique().named("creation_item_generation"));
        items.ensureIndex(new Index().on("creationId", Direction.ASC).on("position", Direction.ASC)
                .named("creation_item_position"));
    }
}
