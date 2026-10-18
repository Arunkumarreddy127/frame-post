package com.example.framepost.config;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ProblemDetail> handleResponseStatusException(ResponseStatusException exception) {
        HttpStatusCode status = exception.getStatusCode();
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, exception.getReason() == null
                ? "Request could not be completed"
                : exception.getReason());
        return ResponseEntity.status(status).body(detail);
    }
}
