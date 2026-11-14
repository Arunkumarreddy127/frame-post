package com.example.framepost.page;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.auth.User;
import com.example.framepost.instruction.InstructionFileRepository;
import com.example.framepost.storage.StorageService;

@Service
public class PageService {

    private static final long MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
    private static final List<String> PROFILE_IMAGE_TYPES = List.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");

    private final PageRepository pageRepository;
    private final InstructionFileRepository instructionFiles;
    private final StorageService storage;

    public PageService(
            PageRepository pageRepository,
            InstructionFileRepository instructionFiles,
            StorageService storage
    ) {
        this.pageRepository = pageRepository;
        this.instructionFiles = instructionFiles;
        this.storage = storage;
    }

    public List<Page> list(User user) {
        return pageRepository.findByUserIdOrderByUpdatedAtDesc(user.id());
    }

    public Page get(User user, String id) {
        return pageRepository.findByIdAndUserId(id, user.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Page not found"));
    }

    public PageResponse toResponse(Page page) {
        return new PageResponse(
                page.id(),
                page.name(),
                page.description(),
                page.bio(),
                page.profileImageKey() == null ? null : storage.publicUrl(page.profileImageKey()),
                page.createdAt(),
                page.updatedAt()
        );
    }

    public Page create(User user, PageRequest request) {
        Page page = new Page(
                null,
                user.id(),
                normalizeText(request.name(), "Name", 120),
                normalizeText(request.description(), "Description", 2000),
                normalizeText(request.bio(), "Bio", 2000),
                null,
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
                existing.profileImageKey(),
                existing.createdAt(),
                Instant.now()
        );
        return pageRepository.save(updated);
    }

    public Page create(User user, PageRequest request, MultipartFile profileImage) {
        String name = normalizeText(request.name(), "Name", 120);
        String description = normalizeText(request.description(), "Description", 2000);
        String bio = normalizeText(request.bio(), "Bio", 2000);
        String profileImageKey = storeProfileImage(user, profileImage);
        try {
            Page page = new Page(
                    null,
                    user.id(),
                    name,
                    description,
                    bio,
                    profileImageKey,
                    Instant.now(),
                    Instant.now()
            );
            return pageRepository.save(page);
        } catch (RuntimeException exception) {
            deleteProfileImage(profileImageKey);
            throw exception;
        }
    }

    public Page update(
            User user,
            String id,
            PageRequest request,
            MultipartFile profileImage,
            boolean removeProfileImage
    ) {
        Page existing = get(user, id);
        String name = normalizeText(request.name(), "Name", 120);
        String description = normalizeText(request.description(), "Description", 2000);
        String bio = normalizeText(request.bio(), "Bio", 2000);
        String newProfileImageKey = storeProfileImage(user, profileImage);
        String profileImageKey = newProfileImageKey != null
                ? newProfileImageKey
                : removeProfileImage ? null : existing.profileImageKey();
        Page updated = new Page(
                existing.id(),
                existing.userId(),
                name,
                description,
                bio,
                profileImageKey,
                existing.createdAt(),
                Instant.now()
        );
        try {
            updated = pageRepository.save(updated);
        } catch (RuntimeException exception) {
            if (newProfileImageKey != null) {
                deleteProfileImage(newProfileImageKey);
            }
            throw exception;
        }
        if (newProfileImageKey != null || removeProfileImage) {
            deleteProfileImage(existing.profileImageKey());
        }
        return updated;
    }

    public void delete(User user, String id) {
        Page page = get(user, id);
        instructionFiles.deleteByUserIdAndPageId(user.id(), id);
        pageRepository.delete(page);
        deleteProfileImage(page.profileImageKey());
    }

    private String storeProfileImage(User user, MultipartFile profileImage) {
        if (profileImage == null || profileImage.isEmpty()) {
            return null;
        }
        String contentType = profileImage.getContentType();
        if (contentType == null || !PROFILE_IMAGE_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Profile image must be a JPEG, PNG, WebP or GIF image");
        }
        if (profileImage.getSize() > MAX_PROFILE_IMAGE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile image must be 5 MB or smaller");
        }
        String key = "page-avatars/" + user.id() + "/" + UUID.randomUUID();
        try (var input = profileImage.getInputStream()) {
            storage.store(key, input, profileImage.getSize(), contentType);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to read profile image", exception);
        }
        return key;
    }

    private void deleteProfileImage(String key) {
        if (key != null) {
            storage.delete(key);
        }
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

    public record PageResponse(
            String id,
            String name,
            String description,
            String bio,
            String profileImageUrl,
            Instant createdAt,
            Instant updatedAt
    ) {}
}
