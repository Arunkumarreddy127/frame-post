package com.example.framepost.image;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;

import com.example.framepost.generation.ContentGeneration;
import com.example.framepost.generation.ContentGenerationRepository;
import com.example.framepost.generation.ContentGenerationStore;
import com.example.framepost.generation.ContentGenerationStore.Hydrated;
import com.example.framepost.generation.ContentInput;
import com.example.framepost.generation.ContentOutput;
import com.example.framepost.generation.MediaMetadata;
import static com.example.framepost.generation.ContentGeneration.Provider.OPENAI;

@Repository
public class ImageGenerationRepository {
    private final ContentGenerationRepository repository;
    private final ContentGenerationStore store;

    public ImageGenerationRepository(ContentGenerationRepository repository, ContentGenerationStore store) {
        this.repository = repository;
        this.store = store;
    }

    public ImageGeneration save(ImageGeneration generation) {
        List<ContentInput> inputs = new ArrayList<>();
        for (int index = 0; index < generation.inputKeys().size(); index++) {
            String key = generation.inputKeys().get(index);
            String slot = "attachment-" + (index + 1);
            MediaMetadata metadata = metadata(generation, key);
            String contentType = MediaMetadata.contentTypeFor(key);
            inputs.add(new ContentInput(
                    ContentGenerationStore.inputId(generation.id(), slot), generation.id(), generation.userId(),
                    generation.pageId(), slot, index, key, null, MediaMetadata.fileName(key), contentType,
                    MediaMetadata.mediaTypeFor(contentType), metadata.sizeBytes(), metadata.width(),
                    metadata.height(), metadata.durationSeconds(), generation.createdAt()));
        }
        List<ContentOutput> outputs = new ArrayList<>();
        for (int index = 0; index < generation.results().size(); index++) {
            String key = generation.results().get(index).key();
            MediaMetadata metadata = metadata(generation, key);
            String contentType = MediaMetadata.contentTypeFor(key);
            outputs.add(new ContentOutput(
                    ContentGenerationStore.outputId(generation.id(), index), generation.id(), generation.userId(),
                    generation.pageId(), "image", index, key, null, MediaMetadata.fileName(key), contentType,
                    MediaMetadata.mediaTypeFor(contentType), metadata.sizeBytes(), metadata.width(),
                    metadata.height(), metadata.durationSeconds(), generation.createdAt()));
        }
        ContentGeneration content = ContentGeneration.fromImage(generation,
                inputs.stream().map(ContentInput::id).toList(), outputs.stream().map(ContentOutput::id).toList());
        store.save(content, inputs, outputs);
        return content.toImage(inputs, outputs);
    }

    public List<ImageGeneration> findByUserIdAndPageIdOrderByCreatedAtDesc(String userId, String pageId) {
        return toImages(repository.findByProviderAndUserIdAndPageIdOrderByCreatedAtDesc(OPENAI, userId, pageId));
    }

    public List<ImageGeneration> findByUserIdOrderByCreatedAtDesc(String userId) {
        return toImages(repository.findByProviderAndUserIdOrderByCreatedAtDesc(OPENAI, userId));
    }

    public Optional<ImageGeneration> findByIdAndUserIdAndPageId(String id, String userId, String pageId) {
        return repository.findByProviderAndIdAndUserIdAndPageId(OPENAI, id, userId, pageId)
                .map(content -> toImages(List.of(content)).getFirst());
    }

    public void delete(ImageGeneration generation) {
        store.delete(generation.id());
    }

    private List<ImageGeneration> toImages(List<ContentGeneration> contents) {
        return store.hydrate(contents).stream()
                .map((Hydrated hydrated) -> hydrated.generation().toImage(hydrated.inputs(), hydrated.outputs()))
                .toList();
    }

    private static MediaMetadata metadata(ImageGeneration generation, String key) {
        MediaMetadata metadata = generation.mediaMetadata().get(key);
        return metadata != null ? metadata : new MediaMetadata(null, null, null, null);
    }
}
