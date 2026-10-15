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
    void imageRoundTripPreservesSettingsAttachmentOrderOutputsAndLineage() {
        ImageGeneration source = new ImageGeneration("id", "owner", null, "prompt", "model", "auto", "high", 2,
                "png", "auto", "auto", null,
                IntStream.rangeClosed(1, 12).mapToObj(index -> "input-" + index + ".png").toList(),
                List.of(new ImageGeneration.ImageResult("first.png"), new ImageGeneration.ImageResult("second.png")),
                ImageGenerationStatus.COMPLETED, null, Instant.now(), "parent", "parent.png");
        ContentGeneration content = ContentGeneration.fromImage(source);
        assertThat(content.toImage()).isEqualTo(source);
        assertThat(content.inputs()).containsEntry("count", "2");
        assertThat(content.outputs()).extracting(ContentGeneration.Output::contentType).containsOnly("image/png");
        assertThatThrownBy(content::toRunningHub).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void runningHubRoundTripPreservesNamedFilesTaskAndMissingResult() {
        RunningHubGeneration source = new RunningHubGeneration("id", "owner", "page", "workflow",
                Map.of("prompt", "motion", "seconds", "8"), Map.of("image", "input.png"),
                null, null, null, "task", RunningHubGenerationStatus.PROCESSING, null, "plus", Instant.now());
        ContentGeneration content = ContentGeneration.fromRunningHub(source, "video");
        assertThat(content.toRunningHub()).isEqualTo(source);
        assertThat(content.generationType()).isEqualTo(ContentGeneration.MediaType.VIDEO);
        assertThat(content.outputs()).isEmpty();
        assertThatThrownBy(content::toImage).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void runningHubCompletedImageAndNullMapsRoundTrip() {
        RunningHubGeneration source = new RunningHubGeneration("id", "owner", "page", "workflow", null, null,
                "output.webp", "image", "image/webp", "task", RunningHubGenerationStatus.COMPLETED,
                null, null, Instant.now());
        ContentGeneration content = ContentGeneration.fromRunningHub(source, "image");
        assertThat(content.toRunningHub().resultKey()).isEqualTo("output.webp");
        assertThat(content.toRunningHub().inputs()).isEmpty();
        assertThat(content.toRunningHub().instanceType()).isNull();
    }
}