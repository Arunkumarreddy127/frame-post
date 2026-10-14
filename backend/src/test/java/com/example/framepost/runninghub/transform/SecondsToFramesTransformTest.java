package com.example.framepost.runninghub.transform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Map;

import org.junit.jupiter.api.Test;

class SecondsToFramesTransformTest {

    private final SecondsToFramesTransform transform = new SecondsToFramesTransform();

    @Test
    void multipliesSecondsByFps() {
        assertEquals("192", frames("8", "24"));
        assertEquals("120", frames("5", "24"));
    }

    @Test
    void rejectsNonPositiveDurationOrFps() {
        assertThrows(IllegalArgumentException.class, () -> frames("0", "24"));
        assertThrows(IllegalArgumentException.class, () -> frames("8", "0"));
    }

    private String frames(String seconds, String fps) {
        Map<String, String> out = transform.apply(
                new TransformInput(Map.of("seconds", seconds), Map.of()), Map.of("fps", fps));
        return out.get("frames");
    }
}
