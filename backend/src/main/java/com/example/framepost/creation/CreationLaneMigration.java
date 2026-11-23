package com.example.framepost.creation;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Updates;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Removes the retired {@code laneId} field from creation items. Run once with
 * {@code --spring.profiles.active=migrate-creation-lanes}; add {@code --dry-run} to only count.
 * Safe to re-run: documents without the field are not matched.
 */
@Component
@Profile("migrate-creation-lanes")
public class CreationLaneMigration implements ApplicationRunner {

    static final String ITEMS_COLLECTION = "creation_items";
    private static final Logger log = LoggerFactory.getLogger(CreationLaneMigration.class);
    private final MongoTemplate mongo;
    private final ApplicationContext context;

    public CreationLaneMigration(MongoTemplate mongo, ApplicationContext context) {
        this.mongo = mongo;
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean dryRun = args.containsOption("dry-run");
        var collection = mongo.getCollection(ITEMS_COLLECTION);
        var filter = Filters.exists("laneId");
        long matched = collection.countDocuments(filter);
        long modified = 0;
        if (!dryRun && matched > 0) {
            modified = collection.updateMany(filter, Updates.unset("laneId")).getModifiedCount();
        }
        log.info("Creation lane migration: matched={}, modified={}, dryRun={}", matched, modified, dryRun);
        SpringApplication.exit(context);
    }
}
