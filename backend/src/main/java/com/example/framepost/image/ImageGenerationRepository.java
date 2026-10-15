package com.example.framepost.image;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Repository;
import com.example.framepost.generation.ContentGeneration;
import com.example.framepost.generation.ContentGenerationRepository;
import static com.example.framepost.generation.ContentGeneration.Provider.OPENAI;

@Repository
public class ImageGenerationRepository {
    private final ContentGenerationRepository repository;

    public ImageGenerationRepository(ContentGenerationRepository repository) {
        this.repository = repository;
    }

    public ImageGeneration save(ImageGeneration generation) {
        return repository.save(ContentGeneration.fromImage(generation)).toImage();
    }

    public List<ImageGeneration> findByUserIdAndPageIdOrderByCreatedAtDesc(String userId, String pageId) {
        return repository.findByProviderAndUserIdAndPageIdOrderByCreatedAtDesc(OPENAI, userId, pageId)
                .stream().map(ContentGeneration::toImage).toList();
    }

    public List<ImageGeneration> findByUserIdOrderByCreatedAtDesc(String userId) {
        return repository.findByProviderAndUserIdOrderByCreatedAtDesc(OPENAI, userId)
                .stream().map(ContentGeneration::toImage).toList();
    }

    public Optional<ImageGeneration> findByIdAndUserIdAndPageId(String id, String userId, String pageId) {
        return repository.findByProviderAndIdAndUserIdAndPageId(OPENAI, id, userId, pageId).map(ContentGeneration::toImage);
    }

    public void delete(ImageGeneration generation) {
        repository.deleteByProviderAndId(OPENAI, generation.id());
    }
}
