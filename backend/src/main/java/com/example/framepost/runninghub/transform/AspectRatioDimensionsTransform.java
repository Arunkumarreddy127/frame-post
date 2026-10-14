package com.example.framepost.runninghub.transform;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import javax.imageio.ImageIO;

import org.springframework.stereotype.Component;

/**
 * Derives width and height from a longest side and an aspect ratio. The {@code keep} ratio reads
 * the source image dimensions. Output sides snap to the {@code step} param, with a minimum of one step.
 */
@Component
public class AspectRatioDimensionsTransform implements InputTransform {

    static final String ROLE_LONGEST_SIDE = "longestSide";
    static final String ROLE_ASPECT_RATIO = "aspectRatio";
    static final String ROLE_IMAGE = "image";
    static final String OUTPUT_WIDTH = "width";
    static final String OUTPUT_HEIGHT = "height";
    static final String KEEP = "keep";

    private static final Map<String, Double> RATIOS = Map.of(
            "1:1", 1.0, "16:9", 16.0 / 9.0, "9:16", 9.0 / 16.0, "2:3", 2.0 / 3.0);

    @Override
    public String type() {
        return "aspectRatioDimensions";
    }

    @Override
    public Set<String> roles() {
        return Set.of(ROLE_LONGEST_SIDE, ROLE_ASPECT_RATIO, ROLE_IMAGE);
    }

    @Override
    public Set<String> outputs() {
        return Set.of(OUTPUT_WIDTH, OUTPUT_HEIGHT);
    }

    @Override
    public Map<String, String> apply(TransformInput input, Map<String, String> params) {
        int longestSide = Integer.parseInt(input.values().get(ROLE_LONGEST_SIDE));
        String aspectRatio = input.values().get(ROLE_ASPECT_RATIO);
        int step = Integer.parseInt(params.getOrDefault("step", "32"));
        if (longestSide <= 0) {
            throw new IllegalArgumentException("Longest side must be positive");
        }
        double ratio = KEEP.equals(aspectRatio)
                ? keepRatio(input.files().get(ROLE_IMAGE))
                : ratioFor(aspectRatio);
        int width;
        int height;
        if (ratio >= 1) {
            width = longestSide;
            height = snap(longestSide / ratio, step);
        } else {
            height = longestSide;
            width = snap(longestSide * ratio, step);
        }
        return Map.of(OUTPUT_WIDTH, String.valueOf(width), OUTPUT_HEIGHT, String.valueOf(height));
    }

    private static double ratioFor(String aspectRatio) {
        Double ratio = RATIOS.get(aspectRatio);
        if (ratio == null) {
            throw new IllegalArgumentException("Choose a supported aspect ratio");
        }
        return ratio;
    }

    private static double keepRatio(byte[] image) {
        BufferedImage decoded;
        try {
            decoded = image == null ? null : ImageIO.read(new ByteArrayInputStream(image));
        } catch (IOException exception) {
            throw new IllegalArgumentException("Unable to read the image dimensions for keep ratio");
        }
        if (decoded == null) {
            throw new IllegalArgumentException("Unable to read the image dimensions for keep ratio");
        }
        return (double) decoded.getWidth() / decoded.getHeight();
    }

    private static int snap(double value, int step) {
        return Math.max(step, (int) Math.round(value / step) * step);
    }
}
