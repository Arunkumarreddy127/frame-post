package com.example.framepost.generation;

/** A stored Library file used as a generation input. It keeps its original key instead of being copied. */
public record LibraryFile(String key, String name, String contentType, byte[] bytes, MediaMetadata metadata) {
}
