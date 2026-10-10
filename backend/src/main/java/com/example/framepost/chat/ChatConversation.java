package com.example.framepost.chat;

import java.time.Instant;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.PersistenceCreator;
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
        Instant updatedAt,
        List<String> instructionFileIds
) {

    @PersistenceCreator
    public ChatConversation {
        instructionFileIds = instructionFileIds == null ? List.of() : List.copyOf(instructionFileIds);
    }

    public ChatConversation(
            String id,
            String userId,
            String pageId,
            String title,
            String model,
            Instant createdAt,
            Instant updatedAt
    ) {
        this(id, userId, pageId, title, model, createdAt, updatedAt, List.of());
    }

    ChatConversation with(String title, String model, Instant updatedAt) {
        return new ChatConversation(id, userId, pageId, title, model, createdAt, updatedAt, instructionFileIds);
    }

    ChatConversation withInstructionFileIds(List<String> ids, Instant updatedAt) {
        return new ChatConversation(id, userId, pageId, title, model, createdAt, updatedAt, ids);
    }
}
