package com.example.framepost.instruction;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("instruction_files")
@CompoundIndex(name = "user_scope_name", def = "{'userId': 1, 'pageId': 1, 'name': 1}")
public record InstructionFile(
        @Id String id,
        @Indexed String userId,
        String pageId,
        String name,
        String content,
        Instant createdAt,
        Instant updatedAt
) {
}
