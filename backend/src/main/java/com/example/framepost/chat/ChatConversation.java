package com.example.framepost.chat;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("chat_conversations")
@CompoundIndex(name = "user_scope_updated", def = "{'userId': 1, 'pageId': 1, 'updatedAt': -1}")
public record ChatConversation(
        @Id String id,
        @Indexed String userId,
        String pageId,
        String title,
        String model,
        Instant createdAt,
        Instant updatedAt
) {
}
