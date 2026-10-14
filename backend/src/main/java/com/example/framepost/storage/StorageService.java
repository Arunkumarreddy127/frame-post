package com.example.framepost.storage;

import java.io.InputStream;

public interface StorageService {

    void store(String key, InputStream content, long contentLength, String contentType);

    void copy(String sourceKey, String targetKey);

    void delete(String key);

    String publicUrl(String key);
}
