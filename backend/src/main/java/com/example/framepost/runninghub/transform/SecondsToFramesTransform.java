package com.example.framepost.runninghub.transform;

import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

/** Converts a duration in seconds into a frame count using the {@code fps} param. */
@Component
public class SecondsToFramesTransform implements InputTransform {

    static final String ROLE_SECONDS = "seconds";
    static final String OUTPUT_FRAMES = "frames";

    @Override
    public String type() {
        return "secondsToFrames";
    }

    @Override
    public Set<String> roles() {
        return Set.of(ROLE_SECONDS);
    }

    @Override
    public Set<String> outputs() {
        return Set.of(OUTPUT_FRAMES);
    }

    @Override
    public Map<String, String> apply(TransformInput input, Map<String, String> params) {
        int seconds = Integer.parseInt(input.values().get(ROLE_SECONDS));
        int fps = Integer.parseInt(params.getOrDefault("fps", "24"));
        if (seconds <= 0 || fps <= 0) {
            throw new IllegalArgumentException("Duration must be positive");
        }
        return Map.of(OUTPUT_FRAMES, String.valueOf(seconds * fps));
    }
}
