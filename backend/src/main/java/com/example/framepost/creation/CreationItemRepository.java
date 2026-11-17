package com.example.framepost.creation;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface CreationItemRepository extends MongoRepository<CreationItem, String> {

    List<CreationItem> findByCreationIdOrderByPositionAsc(String creationId);

    List<CreationItem> findByCreationIdIn(Collection<String> creationIds);

    Optional<CreationItem> findFirstByCreationIdOrderByPositionDesc(String creationId);

    Optional<CreationItem> findByIdAndCreationId(String id, String creationId);

    boolean existsByGenerationId(String generationId);

    List<CreationItem> findByGenerationIdIn(Collection<String> generationIds);

    void deleteByCreationId(String creationId);

    void deleteByGenerationId(String generationId);
}
