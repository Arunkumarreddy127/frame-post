package com.example.framepost.generation;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ContentOutputRepository extends MongoRepository<ContentOutput, String> {
    List<ContentOutput> findByGenerationIdIn(List<String> generationIds);
    List<ContentOutput> findByGenerationId(String generationId);
    void deleteByGenerationId(String generationId);
}
