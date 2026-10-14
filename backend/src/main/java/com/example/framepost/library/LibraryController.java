package com.example.framepost.library;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.library.LibraryService.LibraryResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class LibraryController {

    private static final String COOKIE_NAME = "framepost_session";

    private final LibraryService service;
    private final AuthService authService;

    public LibraryController(LibraryService service, AuthService authService) {
        this.service = service;
        this.authService = authService;
    }

    @GetMapping("/library")
    public LibraryResponse library(HttpServletRequest request) {
        return service.all(currentUser(request));
    }

    @GetMapping("/pages/{pageId}/library")
    public LibraryResponse libraryForPage(@PathVariable String pageId, HttpServletRequest request) {
        return service.forPage(currentUser(request), pageId);
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
