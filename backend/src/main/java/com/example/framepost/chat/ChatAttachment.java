package com.example.framepost.chat;

public record ChatAttachment(
        String name,
        String contentType,
        long sizeBytes,
        String storageKey
) {
}