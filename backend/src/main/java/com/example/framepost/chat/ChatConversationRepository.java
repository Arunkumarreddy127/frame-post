package com.example.framepost.chat;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface ChatConversationRepository extends MongoRepository<ChatConversation, String> {

    List<ChatConversation> findByUserIdAndPageIdIsNullOrderByUpdatedAtDesc(String userId);

    List<ChatConversation> findByUserIdOrderByUpdatedAtDesc(String userId);

    List<ChatConversation> findByUserIdAndPageIdOrderByUpdatedAtDesc(String userId, String pageId);

    Optional<ChatConversation> findByIdAndUserIdAndPageIdIsNull(String id, String userId);

    Optional<ChatConversation> findByIdAndUserIdAndPageId(String id, String userId, String pageId);
}
