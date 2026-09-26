package com.example.framepost.storage;

import java.io.InputStream;

public interface StorageService {

    String store(String key, InputStream content, long contentLength, String contentType);

    void delete(String key);
}
