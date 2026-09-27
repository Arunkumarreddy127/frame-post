package com.example.framepost.page;

import java.util.List;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

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

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.page.PageService.PageRequest;
import com.example.framepost.page.PageService.PageResponse;

@RestController
@RequestMapping("/api/pages")
public class PageController {

    private static final String COOKIE_NAME = "framepost_session";

    private final PageService pageService;
    private final AuthService authService;

    public PageController(PageService pageService, AuthService authService) {
        this.pageService = pageService;
        this.authService = authService;
    }

    @GetMapping
    public List<PageResponse> list(HttpServletRequest request) {
        return pageService.list(currentUser(request)).stream()
                .map(PageResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    public PageResponse get(@PathVariable String id, HttpServletRequest request) {
        return PageResponse.from(pageService.get(currentUser(request), id));
    }

    @PostMapping
    public PageResponse create(@RequestBody PageRequest request, HttpServletRequest servletRequest) {
        return PageResponse.from(pageService.create(currentUser(servletRequest), request));
    }

    @PutMapping("/{id}")
    public PageResponse update(@PathVariable String id, @RequestBody PageRequest request, HttpServletRequest servletRequest) {
        return PageResponse.from(pageService.update(currentUser(servletRequest), id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id, HttpServletRequest request) {
        pageService.delete(currentUser(request), id);
    }

    private User currentUser(HttpServletRequest request) {
        if (request.getCookies() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
        }
        for (Cookie cookie : request.getCookies()) {
            if (COOKIE_NAME.equals(cookie.getName())) {
                return authService.findBySession(cookie.getValue());
            }
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
    }
}
