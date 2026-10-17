package com.example.framepost.generation;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ContentInputRepository extends MongoRepository<ContentInput, String> {
    List<ContentInput> findByGenerationIdIn(List<String> generationIds);
    List<ContentInput> findByGenerationId(String generationId);
    void deleteByGenerationId(String generationId);
}
