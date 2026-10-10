package com.example.framepost.instruction;

import java.util.List;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.instruction.InstructionFileService.InstructionFileRequest;
import com.example.framepost.instruction.InstructionFileService.InstructionFileUpdateRequest;
import com.example.framepost.instruction.InstructionFileService.InstructionFileResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class InstructionFileController {

    private static final String COOKIE_NAME = "framepost_session";

    private final InstructionFileService instructionService;
    private final AuthService authService;

    public InstructionFileController(InstructionFileService instructionService, AuthService authService) {
        this.instructionService = instructionService;
        this.authService = authService;
    }

    @GetMapping("/instructions")
    public List<InstructionFileResponse> listUserFiles(HttpServletRequest request) {
        return toResponses(instructionService.list(currentUser(request), null));
    }

    @PostMapping("/instructions")
    @ResponseStatus(HttpStatus.CREATED)
    public InstructionFileResponse createUserFile(
            @RequestBody InstructionFileRequest body,
            HttpServletRequest request
    ) {
        return InstructionFileResponse.from(instructionService.create(currentUser(request), null, body));
    }

    @GetMapping("/pages/{pageId}/instructions")
    public List<InstructionFileResponse> listPageFiles(@PathVariable String pageId, HttpServletRequest request) {
        return toResponses(instructionService.list(currentUser(request), pageId));
    }

    @PostMapping("/pages/{pageId}/instructions")
    @ResponseStatus(HttpStatus.CREATED)
    public InstructionFileResponse createPageFile(
            @PathVariable String pageId,
            @RequestBody InstructionFileRequest body,
            HttpServletRequest request
    ) {
        return InstructionFileResponse.from(instructionService.create(currentUser(request), pageId, body));
    }

    @PutMapping("/instructions/{id}")
    public InstructionFileResponse update(
            @PathVariable String id,
            @RequestBody InstructionFileUpdateRequest body,
            HttpServletRequest request
    ) {
        return InstructionFileResponse.from(instructionService.update(currentUser(request), id, body));
    }

    @DeleteMapping("/instructions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, HttpServletRequest request) {
        instructionService.delete(currentUser(request), id);
    }

    private List<InstructionFileResponse> toResponses(List<InstructionFile> files) {
        return files.stream().map(InstructionFileResponse::from).toList();
    }

    private User currentUser(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (COOKIE_NAME.equals(cookie.getName())) {
                    return authService.findBySession(cookie.getValue());
                }
            }
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }
}
