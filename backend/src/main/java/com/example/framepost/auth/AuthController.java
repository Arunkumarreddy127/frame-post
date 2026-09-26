package com.example.framepost.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.config.AuthProperties;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String COOKIE_NAME = "framepost_session";

    private final AuthService authService;
    private final AuthProperties properties;

    public AuthController(AuthService authService, AuthProperties properties) {
        this.authService = authService;
        this.properties = properties;
    }

    @PostMapping("/register")
    public UserResponse register(@RequestBody Credentials credentials, HttpServletResponse response) {
        User user = authService.register(credentials.username(), credentials.password());
        writeSessionCookie(response, authService.createSession(user));
        return UserResponse.from(user);
    }

    @PostMapping("/login")
    public UserResponse login(@RequestBody Credentials credentials, HttpServletResponse response) {
        User user = authService.authenticate(credentials.username(), credentials.password());
        writeSessionCookie(response, authService.createSession(user));
        return UserResponse.from(user);
    }

    @GetMapping("/me")
    public UserResponse me(HttpServletRequest request) {
        return UserResponse.from(authService.findBySession(readSessionCookie(request)));
    }

    @PostMapping("/logout")
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        authService.deleteSession(readSessionCookie(request));
        Cookie cookie = new Cookie(COOKIE_NAME, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(properties.cookieSecure());
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    private void writeSessionCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie(COOKIE_NAME, token);
        cookie.setHttpOnly(true);
        cookie.setSecure(properties.cookieSecure());
        cookie.setPath("/");
        cookie.setMaxAge((int) (properties.sessionHours() * 60 * 60));
        response.addCookie(cookie);
    }

    private String readSessionCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (COOKIE_NAME.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    public record Credentials(String username, String password) {
    }

    public record UserResponse(String username) {
        static UserResponse from(User user) {
            return new UserResponse(user.username());
        }
    }
}
