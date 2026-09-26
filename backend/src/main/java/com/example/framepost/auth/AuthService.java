package com.example.framepost.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.framepost.config.AuthProperties;

@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final UserSessionRepository sessions;
    private final PasswordEncoder passwordEncoder;
    private final AuthProperties properties;

    public AuthService(
            UserRepository users,
            UserSessionRepository sessions,
            PasswordEncoder passwordEncoder,
            AuthProperties properties
    ) {
        this.users = users;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
    }

    public User register(String username, String password) {
        String normalizedUsername = normalizeUsername(username);
        validatePassword(password);
        if (users.existsByUsername(normalizedUsername)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already registered");
        }
        return users.save(new User(
                null,
                normalizedUsername,
                passwordEncoder.encode(password),
                Instant.now()
        ));
    }

    public User authenticate(String username, String password) {
        User user = users.findByUsername(normalizeUsername(username))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));
        if (!passwordEncoder.matches(password, user.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        return user;
    }

    public String createSession(User user) {
        byte[] tokenBytes = new byte[32];
        RANDOM.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        Instant expiresAt = Instant.now().plus(properties.sessionHours(), ChronoUnit.HOURS);
        sessions.save(new UserSession(null, hash(token), user.id(), expiresAt));
        return token;
    }

    public User findBySession(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
        }
        UserSession session = sessions.findByTokenHashAndExpiresAtAfter(hash(token), Instant.now())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required"));
        return users.findById(session.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required"));
    }

    public void deleteSession(String token) {
        if (token != null && !token.isBlank()) {
            sessions.deleteAll(sessions.findByTokenHashAndExpiresAtAfter(hash(token), Instant.now()).stream().toList());
        }
    }

    private String normalizeUsername(String username) {
        if (username == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is required");
        }
        String normalized = username.trim().toLowerCase();
        if (!normalized.matches("[a-z0-9_]{3,30}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username must be 3-30 letters, numbers, or underscores");
        }
        return normalized;
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 128) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be 8-128 characters");
        }
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash session token", exception);
        }
    }
}
