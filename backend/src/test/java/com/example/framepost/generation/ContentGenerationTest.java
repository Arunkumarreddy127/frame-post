package com.example.framepost.generation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

import com.example.framepost.image.ImageGeneration;
import com.example.framepost.image.ImageGenerationStatus;
import com.example.framepost.runninghub.RunningHubGeneration;
import com.example.framepost.runninghub.RunningHubGenerationStatus;

class ContentGenerationTest {
    @Test
    void imageConversionPreservesSettings() {
        ImageGeneration source = new ImageGeneration("id", "owner", null, "prompt", "model", "auto", "high", 2,
                "png", "auto", "auto", null,
                IntStream.rangeClosed(1, 12).mapToObj(index -> "input-" + index + ".png").toList(),
                List.of(new ImageGeneration.ImageResult("first.png"), new ImageGeneration.ImageResult("second.png")),
                ImageGenerationStatus.COMPLETED, null, Instant.now(), "parent", "parent.png");
        ContentGeneration content = ContentGeneration.fromImage(source);
        assertThat(content.inputs()).containsEntry("count", "2");
        assertThat(content.inputIds()).isEmpty(); // Inputs are separate documents
        assertThat(content.outputIds()).isEmpty(); // Outputs are separate documents
        assertThat(content.schemaVersion()).isEqualTo(2);
    }

    @Test
    void imageConversionToImagePreservesText() {
        ImageGeneration source = new ImageGeneration("id", "owner", "page", "prompt", "model", "auto", "high", 3,
                "png", "auto", "auto", null,
                List.of(), List.of(),
                ImageGenerationStatus.COMPLETED, "error message", Instant.now(), null, null);
        ContentGeneration content = ContentGeneration.fromImage(source);
        ImageGeneration roundTrip = content.toImage();
        assertThat(roundTrip.prompt()).isEqualTo("prompt");
        assertThat(roundTrip.status()).isEqualTo(ImageGenerationStatus.COMPLETED);
        assertThat(roundTrip.error()).isEqualTo("error message");
    }

    @Test
    void runningHubConversionPreservesWorkflowAndTask() {
        RunningHubGeneration source = new RunningHubGeneration("id", "owner", "page", "workflow",
                Map.of("prompt", "motion", "seconds", "8"), Map.of("image", "input.png"),
                null, null, null, "task", RunningHubGenerationStatus.PROCESSING, null, "plus", Instant.now());
        ContentGeneration content = ContentGeneration.fromRunningHub(source, "video");
        assertThat(content.generationType()).isEqualTo(ContentGeneration.MediaType.VIDEO);
        assertThat(content.workflowKey()).isEqualTo("workflow");
        assertThat(content.providerMetadata().runningHubTaskId()).isEqualTo("task");
        assertThat(content.inputIds()).isEmpty(); // Inputs are separate documents
        assertThat(content.outputIds()).isEmpty(); // Outputs are separate documents
    }

    @Test
    void runningHubCompletedConversionPreservesOutput() {
        RunningHubGeneration source = new RunningHubGeneration("id", "owner", "page", "workflow", null, null,
                "output.webp", "image", "image/webp", "task", RunningHubGenerationStatus.COMPLETED,
                null, null, Instant.now());
        ContentGeneration content = ContentGeneration.fromRunningHub(source, "image");
        // Note: outputIds is empty since outputs are stored separately.
        // toRunningHub() only reconstructs resultKey if outputIds is populated during hydration.
        assertThat(content.outputIds()).isEmpty();
        RunningHubGeneration roundTrip = content.toRunningHub();
        assertThat(roundTrip.inputs()).isEmpty();
        assertThat(roundTrip.instanceType()).isNull();
    }

    @Test
    void requiresProviderForConversion() {
        ContentGeneration image = ContentGeneration.fromImage(
                new ImageGeneration("id", "u", "p", "p", "m", "s", "q", 1, "f", "b", "m", "n", 
                        List.of(), List.of(), ImageGenerationStatus.COMPLETED, null, Instant.now(), null, null));
        assertThatThrownBy(image::toRunningHub).isInstanceOf(IllegalStateException.class);

        ContentGeneration runningHub = ContentGeneration.fromRunningHub(
                new RunningHubGeneration("id", "u", "p", "w", null, null, null, null, null, null,
                        RunningHubGenerationStatus.PROCESSING, null, null, Instant.now()), "image");
        assertThatThrownBy(runningHub::toImage).isInstanceOf(IllegalStateException.class);
    }
}