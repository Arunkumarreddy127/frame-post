package com.example.framepost.runninghub;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import com.example.framepost.generation.ContentGeneration;
import com.example.framepost.generation.ContentGenerationRepository;
import static com.example.framepost.generation.ContentGeneration.Provider.RUNNINGHUB;

@Repository
public class RunningHubGenerationRepository {
        private final ContentGenerationRepository repository;
        private final WorkflowRegistry workflows;

        public RunningHubGenerationRepository(ContentGenerationRepository repository, WorkflowRegistry workflows) {
                this.repository = repository;
                this.workflows = workflows;
        }

        public RunningHubGeneration save(RunningHubGeneration generation) {
                String outputType = generation.resultType() != null ? generation.resultType()
                                : workflows.find(generation.workflowKey()).orElseThrow().output().type();
                return repository.save(ContentGeneration.fromRunningHub(generation, outputType)).toRunningHub();
        }

        public Optional<RunningHubGeneration> findById(String id) {
                return repository.findByProviderAndId(RUNNINGHUB, id).map(ContentGeneration::toRunningHub);
        }

        public List<RunningHubGeneration> findByUserIdAndPageIdAndWorkflowKeyOrderByCreatedAtDesc(
                        String userId, String pageId, String workflowKey) {
                return repository.findByProviderAndUserIdAndPageIdAndWorkflowKeyOrderByCreatedAtDesc(RUNNINGHUB, userId, pageId, workflowKey)
                                .stream().map(ContentGeneration::toRunningHub).toList();
        }

        public Optional<RunningHubGeneration> findByIdAndUserIdAndPageIdAndWorkflowKey(
                        String id, String userId, String pageId, String workflowKey) {
                return repository.findByProviderAndIdAndUserIdAndPageIdAndWorkflowKey(RUNNINGHUB, id, userId, pageId, workflowKey)
                                .map(ContentGeneration::toRunningHub);
        }

        public Optional<RunningHubGeneration> findByRunningHubTaskId(String runningHubTaskId) {
                return repository.findByProviderAndProviderMetadataRunningHubTaskId(RUNNINGHUB, runningHubTaskId)
                                .map(ContentGeneration::toRunningHub);
        }

        public List<RunningHubGeneration> findByUserIdOrderByCreatedAtDesc(String userId) {
                return repository.findByProviderAndUserIdOrderByCreatedAtDesc(RUNNINGHUB, userId)
                                .stream().map(ContentGeneration::toRunningHub).toList();
        }

        public List<RunningHubGeneration> findByUserIdAndPageIdOrderByCreatedAtDesc(String userId, String pageId) {
                return repository.findByProviderAndUserIdAndPageIdOrderByCreatedAtDesc(RUNNINGHUB, userId, pageId)
                                .stream().map(ContentGeneration::toRunningHub).toList();
        }
}
