package com.example.framepost.creation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface SceneRepository extends MongoRepository<Scene, String> {

    List<Scene> findByCreationIdOrderByPositionAsc(String creationId);

    Optional<Scene> findFirstByCreationIdOrderByPositionDesc(String creationId);

    Optional<Scene> findByIdAndCreationId(String id, String creationId);

    void deleteByCreationId(String creationId);
}
