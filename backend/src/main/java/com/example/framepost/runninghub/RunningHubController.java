package com.example.framepost.runninghub;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Server-to-server callbacks from RunningHub. Everything the browser uses lives in the generations API. */
@RestController
@RequestMapping("/api")
public class RunningHubController {

    private final RunningHubGenerationService service;

    public RunningHubController(RunningHubGenerationService service) {
        this.service = service;
    }

    @PostMapping("/webhooks/runninghub/{secret}")
    public void runningHubWebhook(@PathVariable String secret, @RequestBody(required = false) String body) {
        service.handleWebhook(secret, body);
    }
}
