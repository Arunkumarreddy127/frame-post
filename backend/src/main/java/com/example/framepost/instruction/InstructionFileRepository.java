package com.example.framepost.instruction;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface InstructionFileRepository extends MongoRepository<InstructionFile, String> {

    List<InstructionFile> findByUserIdAndPageIdIsNullOrderByNameAsc(String userId);

    List<InstructionFile> findByUserIdAndPageIdOrderByNameAsc(String userId, String pageId);

    Optional<InstructionFile> findByIdAndUserId(String id, String userId);

    List<InstructionFile> findByIdInAndUserId(List<String> ids, String userId);

    boolean existsByUserIdAndPageIdIsNullAndNameIgnoreCase(String userId, String name);

    boolean existsByUserIdAndPageIdAndNameIgnoreCase(String userId, String pageId, String name);

    void deleteByUserIdAndPageId(String userId, String pageId);
}
