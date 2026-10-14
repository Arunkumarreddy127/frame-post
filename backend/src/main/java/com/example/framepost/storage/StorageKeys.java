package com.example.framepost.storage;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

import com.example.framepost.auth.User;

/**
 * Builds object keys for user inputs and generated outputs:
 * {@code inputs/{username}-{userId}/{id}/{file}} and {@code outputs/{username}-{userId}/{id}/{file}}.
 */
public final class StorageKeys {

    public static final String INPUTS = "inputs";
    public static final String OUTPUTS = "outputs";

    private StorageKeys() {
    }

    public static String inputPrefix(User user, String id) {
        return prefix(INPUTS, user, id);
    }

    public static String outputPrefix(User user, String id) {
        return prefix(OUTPUTS, user, id);
    }

    /** Returns a kebab-case file name with the given extension, unique within {@code used}. */
    public static String fileName(String originalName, String extension, String fallback, Set<String> used) {
        String stem = stripExtension(baseName(originalName));
        String base = slug(stem);
        if (base.isEmpty()) {
            base = slug(fallback);
        }
        String candidate = base + "." + extension;
        int suffix = 2;
        while (!used.add(candidate)) {
            candidate = base + "-" + suffix++ + "." + extension;
        }
        return candidate;
    }

    /** Lowercase ASCII letters and digits separated by single hyphens. Returns an empty string if nothing is left. */
    public static String slug(String value) {
        if (value == null) {
            return "";
        }
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
    }

    private static String prefix(String folder, User user, String id) {
        String username = slug(user.username());
        if (username.isEmpty()) {
            username = "user";
        }
        return folder + "/" + username + "-" + user.id() + "/" + id + "/";
    }

    private static String baseName(String name) {
        if (name == null) {
            return "";
        }
        int index = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        return index >= 0 ? name.substring(index + 1) : name;
    }

    private static String stripExtension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
