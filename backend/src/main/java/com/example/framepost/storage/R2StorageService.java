package com.example.framepost.storage;

import java.io.InputStream;

import org.springframework.stereotype.Service;

import com.example.framepost.config.R2Properties;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class R2StorageService implements StorageService {

    private final S3Client client;
    private final R2Properties properties;

    public R2StorageService(S3Client client, R2Properties properties) {
        this.client = client;
        this.properties = properties;
    }

    @Override
    public String store(String key, InputStream content, long contentLength, String contentType) {
        client.putObject(
                PutObjectRequest.builder()
                        .bucket(properties.bucketName())
                        .key(key)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromInputStream(content, contentLength));
        return publicUrl(key);
    }

    @Override
    public void delete(String key) {
        client.deleteObject(DeleteObjectRequest.builder()
                .bucket(properties.bucketName())
                .key(key)
                .build());
    }

    private String publicUrl(String key) {
        if (properties.publicBaseUrl() == null || properties.publicBaseUrl().isBlank()) {
            return key;
        }
        return properties.publicBaseUrl().replaceAll("/$", "") + "/" + key;
    }
}
