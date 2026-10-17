package com.example.framepost.generation;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/** Size and dimensions captured when a media file is stored. Video duration is not captured yet. */
public record MediaMetadata(Long sizeBytes, Integer width, Integer height, Long durationSeconds) {

    public static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    public static MediaMetadata of(byte[] bytes, String contentType) {
        Integer width = null;
        Integer height = null;
        if (contentType != null && contentType.startsWith("image/")) {
            int[] dimensions = imageDimensions(bytes);
            if (dimensions != null) {
                width = dimensions[0];
                height = dimensions[1];
            }
        }
        return new MediaMetadata((long) bytes.length, width, height, null);
    }

    /** Reads only the image header, so large images are not decoded. */
    private static int[] imageDimensions(byte[] bytes) {
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) {
                return null;
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream);
                return new int[] {reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException exception) {
            return null;
        }
    }

    public static String contentTypeFor(String key) {
        String name = key.substring(key.lastIndexOf('/') + 1).toLowerCase(Locale.ROOT);
        int dot = name.lastIndexOf('.');
        String extension = dot >= 0 ? name.substring(dot + 1) : "";
        return switch (extension) {
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            case "mp4" -> "video/mp4";
            case "webm" -> "video/webm";
            case "mov" -> "video/quicktime";
            default -> DEFAULT_CONTENT_TYPE;
        };
    }

    public static String mediaTypeFor(String contentType) {
        return contentType != null && contentType.startsWith("video/") ? "video" : "image";
    }

    public static String fileName(String key) {
        return key.substring(key.lastIndexOf('/') + 1);
    }
}
