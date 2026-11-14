package com.example.framepost.chat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Application-wide rules appended to every chat's developer prompt, loaded once from the classpath. */
@Component
public class GlobalRulesProvider {

    static final String RESOURCE_PATH = "prompts/global-rules.md";

    private final String text;

    @Autowired
    public GlobalRulesProvider() {
        this(load());
    }

    GlobalRulesProvider(String text) {
        this.text = text == null ? "" : text.strip();
    }

    /** Returns the trimmed rules, or an empty string when none are configured. */
    public String text() {
        return text;
    }

    private static String load() {
        ClassPathResource resource = new ClassPathResource(RESOURCE_PATH);
        if (!resource.exists()) {
            return "";
        }
        try (var in = resource.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Unable to read " + RESOURCE_PATH, e);
        }
    }
}
