package com.example.framepost.page;

import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.User;

@Service
public class PageService {

    private final PageRepository pageRepository;

    public PageService(PageRepository pageRepository) {
        this.pageRepository = pageRepository;
    }

    public List<Page> list(User user) {
        return pageRepository.findByUserIdOrderByUpdatedAtDesc(user.id());
    }

    public Page get(User user, String id) {
        return pageRepository.findByIdAndUserId(id, user.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Page not found"));
    }

    public Page create(User user, PageRequest request) {
        Page page = new Page(
                null,
                user.id(),
                normalizeText(request.name(), "Name", 120),
                normalizeText(request.description(), "Description", 2000),
                normalizeText(request.bio(), "Bio", 2000),
                Instant.now(),
                Instant.now()
        );
        return pageRepository.save(page);
    }

    public Page update(User user, String id, PageRequest request) {
        Page existing = get(user, id);
        Page updated = new Page(
                existing.id(),
                existing.userId(),
                normalizeText(request.name(), "Name", 120),
                normalizeText(request.description(), "Description", 2000),
                normalizeText(request.bio(), "Bio", 2000),
                existing.createdAt(),
                Instant.now()
        );
        return pageRepository.save(updated);
    }

    public void delete(User user, String id) {
        Page page = get(user, id);
        pageRepository.delete(page);
    }

    private String normalizeText(String value, String field, int maxLength) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        if (trimmed.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be at most " + maxLength + " characters");
        }
        return trimmed;
    }

    public record PageRequest(String name, String description, String bio) {
    }

    public record PageResponse(String id, String name, String description, String bio, Instant createdAt, Instant updatedAt) {
        public static PageResponse from(Page page) {
            return new PageResponse(page.id(), page.name(), page.description(), page.bio(), page.createdAt(), page.updatedAt());
        }
    }
}
