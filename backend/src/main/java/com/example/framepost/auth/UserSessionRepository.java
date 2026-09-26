package com.example.framepost.auth;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserSessionRepository extends MongoRepository<UserSession, String> {

    Optional<UserSession> findByTokenHashAndExpiresAtAfter(String tokenHash, Instant now);
}
