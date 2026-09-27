package com.example.framepost.page;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface PageRepository extends MongoRepository<Page, String> {

    List<Page> findByUserIdOrderByUpdatedAtDesc(String userId);

    Optional<Page> findByIdAndUserId(String id, String userId);
}
