package com.example.framepost.runninghub;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface RunningHubGenerationRepository extends MongoRepository<RunningHubGeneration, String> {

    List<RunningHubGeneration> findByUserIdAndPageIdAndWorkflowKeyOrderByCreatedAtDesc(
            String userId, String pageId, String workflowKey);

    Optional<RunningHubGeneration> findByIdAndUserIdAndPageIdAndWorkflowKey(
            String id, String userId, String pageId, String workflowKey);

    Optional<RunningHubGeneration> findByRunningHubTaskId(String runningHubTaskId);

    List<RunningHubGeneration> findByUserIdOrderByCreatedAtDesc(String userId);

    List<RunningHubGeneration> findByUserIdAndPageIdOrderByCreatedAtDesc(String userId, String pageId);
}
