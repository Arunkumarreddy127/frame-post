package com.example.framepost.creation;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.generation.ContentGeneration;

/**
 * Validation for shot fields and tool names. Option values from the UI catalog and custom values share
 * the same rules, so the backend stores whatever text the user picked.
 */
final class ShotFields {

    static final Set<String> TOOLS = Set.of("IMAGE", "VIDEO", "EDIT", "UPSCALE", "CHAT");
    private static final int MAX_CHOICE_LENGTH = 60;
    private static final int MAX_SHOT_TYPES = 10;
    private static final int MIN_DURATION_SECONDS = 1;
    private static final int MAX_DURATION_SECONDS = 120;

    private ShotFields() {
    }

    static String choice(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() > MAX_CHOICE_LENGTH) {
            throw badRequest(field + " must be at most " + MAX_CHOICE_LENGTH + " characters");
        }
        return trimmed;
    }

    /** Drops blanks and case-insensitive duplicates, keeping the order the user selected. */
    static List<String> shotTypes(List<String> values) {
        Map<String, String> unique = new LinkedHashMap<>();
        if (values != null) {
            for (String value : values) {
                String choice = choice(value, "Shot type");
                if (choice != null) {
                    unique.putIfAbsent(choice.toLowerCase(Locale.ROOT), choice);
                }
            }
        }
        if (unique.size() > MAX_SHOT_TYPES) {
            throw badRequest("Shot types must be at most " + MAX_SHOT_TYPES);
        }
        return List.copyOf(unique.values());
    }

    static Integer duration(Integer seconds) {
        if (seconds != null && (seconds < MIN_DURATION_SECONDS || seconds > MAX_DURATION_SECONDS)) {
            throw badRequest("Duration must be between " + MIN_DURATION_SECONDS + " and "
                    + MAX_DURATION_SECONDS + " seconds");
        }
        return seconds;
    }

    /** An explicit tool wins. Otherwise the tool follows the generation's media type. */
    static String resolveTool(String requested, ContentGeneration.MediaType mediaType) {
        if (requested == null || requested.isBlank()) {
            return mediaType == null ? null : mediaType.name();
        }
        String tool = requested.trim().toUpperCase(Locale.ROOT);
        if (!TOOLS.contains(tool)) {
            throw badRequest("Tool must be IMAGE, VIDEO, EDIT, UPSCALE or CHAT");
        }
        return tool;
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
