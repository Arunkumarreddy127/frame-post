package com.example.framepost.chat;

import java.time.Instant;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("chat_messages")
@CompoundIndex(name = "conversation_created", def = "{'conversationId': 1, 'createdAt': 1}")
public record ChatMessage(
        @Id String id,
        String conversationId,
        ChatRole role,
        String content,
        String model,
        ChatMessageStatus status,
                Instant createdAt,
                List<ChatAttachment> attachments
) {
        public ChatMessage {
                attachments = attachments == null ? List.of() : List.copyOf(attachments);
        }

        public ChatMessage(
                        String id,
                        String conversationId,
                        ChatRole role,
                        String content,
                        String model,
                        ChatMessageStatus status,
                        Instant createdAt
        ) {
                this(id, conversationId, role, content, model, status, createdAt, List.of());
        }

        public ChatMessage withAttachments(List<ChatAttachment> values) {
                return new ChatMessage(id, conversationId, role, content, model, status, createdAt, values);
        }
}
