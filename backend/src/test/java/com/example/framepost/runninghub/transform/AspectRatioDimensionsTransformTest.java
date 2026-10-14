package com.example.framepost.runninghub.transform;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;
import javax.imageio.ImageIO;

import org.junit.jupiter.api.Test;

class AspectRatioDimensionsTransformTest {

    private static final Map<String, String> PARAMS = Map.of("step", "32");
    private final AspectRatioDimensionsTransform transform = new AspectRatioDimensionsTransform();

    @Test
    void portraitNineSixteenAtLongestSide1344SnapsToWorkflowDefault() {
        Map<String, String> out = apply("1344", "9:16", null);

        assertEquals("768", out.get("width"));
        assertEquals("1344", out.get("height"));
    }

    @Test
    void landscapeSixteenNineUsesLongestSideAsWidth() {
        Map<String, String> out = apply("1024", "16:9", null);

        assertEquals("1024", out.get("width"));
        assertEquals("576", out.get("height"));
    }

    @Test
    void keepRatioUsesImageDimensions() {
        Map<String, String> out = apply("864", "keep", image(1000, 500));

        assertEquals("864", out.get("width"));
        assertEquals("448", out.get("height"));
    }

    @Test
    void rejectsUnsupportedRatioAndNonPositiveSide() {
        assertThrows(IllegalArgumentException.class, () -> apply("1344", "4:3", null));
        assertThrows(IllegalArgumentException.class, () -> apply("0", "9:16", null));
    }

    @Test
    void keepRatioWithoutReadableImageIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> apply("864", "keep", new byte[] {1, 2, 3}));
        assertThrows(IllegalArgumentException.class, () -> apply("864", "keep", null));
    }

    private Map<String, String> apply(String longestSide, String aspectRatio, byte[] image) {
        Map<String, String> values = Map.of("longestSide", longestSide, "aspectRatio", aspectRatio);
        Map<String, byte[]> files = image == null ? Map.of() : Map.of("image", image);
        return transform.apply(new TransformInput(values, files), PARAMS);
    }

    private static byte[] image(int width, int height) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "png", out);
            return out.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
