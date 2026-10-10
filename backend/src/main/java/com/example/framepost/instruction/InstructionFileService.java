package com.example.framepost.instruction;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.example.framepost.auth.User;
import com.example.framepost.page.PageService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InstructionFileService {

    static final int MAX_NAME_LENGTH = 100;
    static final int MAX_CONTENT_LENGTH = 20_000;
    public static final int MAX_SELECTED_FILES = 10;

    private final InstructionFileRepository files;
    private final PageService pageService;

    public InstructionFileService(InstructionFileRepository files, PageService pageService) {
        this.files = files;
        this.pageService = pageService;
    }

    public List<InstructionFile> list(User user, String pageId) {
        List<InstructionFile> result = new ArrayList<>(files.findByUserIdAndPageIdIsNullOrderByNameAsc(user.id()));
        if (pageId != null) {
            pageService.get(user, pageId);
            result.addAll(files.findByUserIdAndPageIdOrderByNameAsc(user.id(), pageId));
        }
        return result;
    }

    public InstructionFile create(User user, String pageId, InstructionFileRequest request) {
        if (pageId != null) {
            pageService.get(user, pageId);
        }
        String name = validateName(request.name());
        String content = validateContent(request.content());
        ensureNameAvailable(user, pageId, name);
        Instant now = Instant.now();
        return files.save(new InstructionFile(null, user.id(), pageId, name, content, now, now));
    }

    public InstructionFile update(User user, String id, InstructionFileRequest request) {
        InstructionFile existing = get(user, id);
        String name = validateName(request.name());
        String content = validateContent(request.content());
        if (!name.equalsIgnoreCase(existing.name())) {
            ensureNameAvailable(user, existing.pageId(), name);
        }
        return files.save(new InstructionFile(
                existing.id(),
                existing.userId(),
                existing.pageId(),
                name,
                content,
                existing.createdAt(),
                Instant.now()
        ));
    }

    public void delete(User user, String id) {
        files.delete(get(user, id));
    }

    public InstructionFile get(User user, String id) {
        return files.findByIdAndUserId(id, user.id())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Instruction file not found"));
    }

    public void deleteForPage(String userId, String pageId) {
        files.deleteByUserIdAndPageId(userId, pageId);
    }

    /** Strictly validates ids for a selection: they must exist and be usable in the given page scope. */
    public List<String> validateSelection(User user, String pageId, List<String> ids) {
        List<String> unique = ids == null ? List.of() : new ArrayList<>(new LinkedHashSet<>(ids));
        if (unique.size() > MAX_SELECTED_FILES) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "At most " + MAX_SELECTED_FILES + " instruction files can be selected"
            );
        }
        Map<String, InstructionFile> byId = files.findByIdInAndUserId(unique, user.id()).stream()
                .collect(Collectors.toMap(InstructionFile::id, Function.identity()));
        for (String id : unique) {
            InstructionFile file = byId.get(id);
            if (file == null || !usableIn(file, pageId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Instruction file is not available");
            }
        }
        return unique;
    }

    /** Resolves selected ids to files in selection order, skipping deleted or out-of-scope files. */
    public List<InstructionFile> resolveSelected(String userId, String pageId, List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        Map<String, InstructionFile> byId = files.findByIdInAndUserId(ids, userId).stream()
                .collect(Collectors.toMap(InstructionFile::id, Function.identity()));
        return ids.stream()
                .map(byId::get)
                .filter(file -> file != null && usableIn(file, pageId))
                .toList();
    }

    private boolean usableIn(InstructionFile file, String pageId) {
        return file.pageId() == null || file.pageId().equals(pageId);
    }

    private void ensureNameAvailable(User user, String pageId, String name) {
        boolean exists = pageId == null
                ? files.existsByUserIdAndPageIdIsNullAndNameIgnoreCase(user.id(), name)
                : files.existsByUserIdAndPageIdAndNameIgnoreCase(user.id(), pageId, name);
        if (exists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An instruction file with this name already exists");
        }
    }

    private String validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        }
        String trimmed = name.trim();
        if (trimmed.length() > MAX_NAME_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Name must be at most " + MAX_NAME_LENGTH + " characters"
            );
        }
        return trimmed;
    }

    private String validateContent(String content) {
        if (content == null || content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Content is required");
        }
        if (content.length() > MAX_CONTENT_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Content must be at most " + MAX_CONTENT_LENGTH + " characters"
            );
        }
        return content;
    }

    public record InstructionFileRequest(String name, String content) {
    }

    public record InstructionFileResponse(
            String id,
            String pageId,
            String scope,
            String name,
            String content,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static InstructionFileResponse from(InstructionFile file) {
            return new InstructionFileResponse(
                    file.id(),
                    file.pageId(),
                    file.pageId() == null ? "user" : "page",
                    file.name(),
                    file.content(),
                    file.createdAt(),
                    file.updatedAt()
            );
        }
    }
}
