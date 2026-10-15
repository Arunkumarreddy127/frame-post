package com.example.framepost.generation;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.example.framepost.generation.ContentGeneration.Provider;

public interface ContentGenerationRepository extends MongoRepository<ContentGeneration, String> {
    List<ContentGeneration> findByUserIdOrderByCreatedAtDesc(String userId);
    List<ContentGeneration> findByUserIdAndPageIdOrderByCreatedAtDesc(String userId, String pageId);
    List<ContentGeneration> findByProviderAndUserIdOrderByCreatedAtDesc(Provider provider, String userId);
    List<ContentGeneration> findByProviderAndUserIdAndPageIdOrderByCreatedAtDesc(Provider provider, String userId, String pageId);
    Optional<ContentGeneration> findByProviderAndIdAndUserIdAndPageId(Provider provider, String id, String userId, String pageId);
    Optional<ContentGeneration> findByProviderAndId(Provider provider, String id);
    List<ContentGeneration> findByProviderAndUserIdAndPageIdAndWorkflowKeyOrderByCreatedAtDesc(
            Provider provider, String userId, String pageId, String workflowKey);
    Optional<ContentGeneration> findByProviderAndIdAndUserIdAndPageIdAndWorkflowKey(
            Provider provider, String id, String userId, String pageId, String workflowKey);
    Optional<ContentGeneration> findByProviderAndProviderMetadataRunningHubTaskId(Provider provider, String taskId);
    void deleteByProviderAndId(Provider provider, String id);
}