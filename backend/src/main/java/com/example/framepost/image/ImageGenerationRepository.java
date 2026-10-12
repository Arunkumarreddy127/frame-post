package com.example.framepost.image;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ImageGenerationRepository extends MongoRepository<ImageGeneration, String> {

    List<ImageGeneration> findByUserIdAndPageIdOrderByCreatedAtDesc(String userId, String pageId);

    Optional<ImageGeneration> findByIdAndUserIdAndPageId(String id, String userId, String pageId);
}
