package com.example.framepost.creation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ShotRepository extends MongoRepository<Shot, String> {

    List<Shot> findByCreationIdOrderByPositionAsc(String creationId);

    List<Shot> findBySceneIdOrderByPositionAsc(String sceneId);

    Optional<Shot> findFirstBySceneIdOrderByPositionDesc(String sceneId);

    Optional<Shot> findByIdAndCreationId(String id, String creationId);

    void deleteByCreationId(String creationId);
}
