package com.example.framepost.creation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface CreationRepository extends MongoRepository<Creation, String> {

    List<Creation> findByUserIdAndPageIdIsNullOrderByUpdatedAtDesc(String userId);

    List<Creation> findByUserIdAndPageIdOrderByUpdatedAtDesc(String userId, String pageId);

    Optional<Creation> findByIdAndUserId(String id, String userId);
}
