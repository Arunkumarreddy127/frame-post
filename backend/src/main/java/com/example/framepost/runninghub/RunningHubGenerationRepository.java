package com.example.framepost.runninghub;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Repository;

import com.example.framepost.generation.ContentGeneration;
import com.example.framepost.generation.ContentGenerationRepository;
import com.example.framepost.generation.ContentGenerationStore;
import com.example.framepost.generation.ContentGenerationStore.Hydrated;
import com.example.framepost.generation.ContentInput;
import com.example.framepost.generation.ContentOutput;
import com.example.framepost.generation.MediaMetadata;
import static com.example.framepost.generation.ContentGeneration.Provider.RUNNINGHUB;

@Repository
public class RunningHubGenerationRepository {
        private final ContentGenerationRepository repository;
        private final ContentGenerationStore store;
        private final WorkflowRegistry workflows;

        public RunningHubGenerationRepository(
                        ContentGenerationRepository repository, ContentGenerationStore store, WorkflowRegistry workflows) {
                this.repository = repository;
                this.store = store;
                this.workflows = workflows;
        }

        public RunningHubGeneration save(RunningHubGeneration generation) {
                String outputType = generation.resultType() != null ? generation.resultType()
                                : workflows.find(generation.workflowKey()).orElseThrow().output().type();

                List<ContentInput> inputs = new ArrayList<>();
                int position = 0;
                Map<String, String> inputKeys = generation.inputFileKeys() == null ? Map.of() : generation.inputFileKeys();
                for (Map.Entry<String, String> file : inputKeys.entrySet()) {
                        String key = file.getValue();
                        MediaMetadata metadata = metadata(generation, key);
                        String contentType = MediaMetadata.contentTypeFor(key);
                        inputs.add(new ContentInput(
                                        ContentGenerationStore.inputId(generation.id(), file.getKey()), generation.id(),
                                        generation.userId(), generation.pageId(), file.getKey(), position++, key, null,
                                        MediaMetadata.fileName(key), contentType, MediaMetadata.mediaTypeFor(contentType),
                                        metadata.sizeBytes(), metadata.width(), metadata.height(),
                                        metadata.durationSeconds(), generation.createdAt()));
                }

                List<ContentOutput> outputs = new ArrayList<>();
                if (generation.resultKey() != null) {
                        String key = generation.resultKey();
                        MediaMetadata metadata = metadata(generation, key);
                        String contentType = generation.resultContentType() != null ? generation.resultContentType()
                                        : MediaMetadata.contentTypeFor(key);
                        outputs.add(new ContentOutput(
                                        ContentGenerationStore.outputId(generation.id(), 0), generation.id(),
                                        generation.userId(), generation.pageId(), outputType, 0, key, null,
                                        MediaMetadata.fileName(key), contentType, MediaMetadata.mediaTypeFor(contentType),
                                        metadata.sizeBytes(), metadata.width(), metadata.height(),
                                        metadata.durationSeconds(), generation.createdAt()));
                }

                ContentGeneration content = ContentGeneration.fromRunningHub(generation, outputType,
                                inputs.stream().map(ContentInput::id).toList(),
                                outputs.stream().map(ContentOutput::id).toList());
                store.save(content, inputs, outputs);
                return content.toRunningHub(inputs, outputs);
        }

        public Optional<RunningHubGeneration> findById(String id) {
                return repository.findByProviderAndId(RUNNINGHUB, id).map(this::toRunningHub);
        }

        public List<RunningHubGeneration> findByUserIdAndPageIdAndWorkflowKeyOrderByCreatedAtDesc(
                        String userId, String pageId, String workflowKey) {
                return toRunningHubs(repository.findByProviderAndUserIdAndPageIdAndWorkflowKeyOrderByCreatedAtDesc(
                                RUNNINGHUB, userId, pageId, workflowKey));
        }

        public Optional<RunningHubGeneration> findByIdAndUserIdAndPageIdAndWorkflowKey(
                        String id, String userId, String pageId, String workflowKey) {
                return repository.findByProviderAndIdAndUserIdAndPageIdAndWorkflowKey(RUNNINGHUB, id, userId, pageId, workflowKey)
                                .map(this::toRunningHub);
        }

        public Optional<RunningHubGeneration> findByRunningHubTaskId(String runningHubTaskId) {
                return repository.findByProviderAndProviderMetadataRunningHubTaskId(RUNNINGHUB, runningHubTaskId)
                                .map(this::toRunningHub);
        }

        public List<RunningHubGeneration> findByUserIdOrderByCreatedAtDesc(String userId) {
                return toRunningHubs(repository.findByProviderAndUserIdOrderByCreatedAtDesc(RUNNINGHUB, userId));
        }

        public List<RunningHubGeneration> findByUserIdAndPageIdOrderByCreatedAtDesc(String userId, String pageId) {
                return toRunningHubs(repository.findByProviderAndUserIdAndPageIdOrderByCreatedAtDesc(RUNNINGHUB, userId, pageId));
        }

        public void delete(RunningHubGeneration generation) {
                store.delete(generation.id());
        }

        private RunningHubGeneration toRunningHub(ContentGeneration content) {
                return toRunningHubs(List.of(content)).getFirst();
        }

        private List<RunningHubGeneration> toRunningHubs(List<ContentGeneration> contents) {
                return store.hydrate(contents).stream()
                                .map((Hydrated hydrated) -> hydrated.generation().toRunningHub(hydrated.inputs(), hydrated.outputs()))
                                .toList();
        }

        private static MediaMetadata metadata(RunningHubGeneration generation, String key) {
                MediaMetadata metadata = generation.mediaMetadata().get(key);
                return metadata != null ? metadata : new MediaMetadata(null, null, null, null);
        }
}
