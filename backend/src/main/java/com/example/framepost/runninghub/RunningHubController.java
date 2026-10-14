package com.example.framepost.runninghub;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.runninghub.RunningHubGenerationService.GenerationResponse;
import com.example.framepost.runninghub.RunningHubGenerationService.WorkflowView;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api")
public class RunningHubController {

    private static final String COOKIE_NAME = "framepost_session";

    private final RunningHubGenerationService service;
    private final RunningHubGenerationEvents events;
    private final AuthService authService;

    public RunningHubController(
            RunningHubGenerationService service,
            RunningHubGenerationEvents events,
            AuthService authService
    ) {
        this.service = service;
        this.events = events;
        this.authService = authService;
    }

    @GetMapping("/runninghub/workflows")
    public List<WorkflowView> workflows(HttpServletRequest request) {
        currentUser(request);
        return service.workflows();
    }

    @GetMapping("/pages/{pageId}/runninghub/{workflowKey}/generations")
    public List<GenerationResponse> listForPage(
            @PathVariable String pageId,
            @PathVariable String workflowKey,
            HttpServletRequest request
    ) {
        return service.list(currentUser(request), pageId, workflowKey);
    }

    @GetMapping("/pages/{pageId}/runninghub/{workflowKey}/generations/{id}")
    public GenerationResponse getForPage(
            @PathVariable String pageId,
            @PathVariable String workflowKey,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        return service.get(currentUser(request), pageId, workflowKey, id);
    }

    @GetMapping(value = "/pages/{pageId}/runninghub/{workflowKey}/generations/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamForPage(
            @PathVariable String pageId,
            @PathVariable String workflowKey,
            @PathVariable String id,
            HttpServletRequest request
    ) {
        User user = currentUser(request);
        service.get(user, pageId, workflowKey, id);
        SseEmitter emitter = events.register(id);
        events.sendSnapshot(emitter, id, service.get(user, pageId, workflowKey, id));
        return emitter;
    }

    /**
     * Accepts a multipart form whose parts are named after the workflow's inputs. File parts are
     * matched by name; every other part is a text value.
     */
    @PostMapping(value = "/pages/{pageId}/runninghub/{workflowKey}/generations", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public GenerationResponse generateForPage(
            @PathVariable String pageId,
            @PathVariable String workflowKey,
            MultipartHttpServletRequest request
    ) {
        Map<String, String> textValues = new LinkedHashMap<>();
        request.getParameterMap().forEach((name, values) -> {
            if (values.length > 0) {
                textValues.put(name, values[0]);
            }
        });
        String instanceType = textValues.remove("instanceType");
        return service.start(currentUser(request), pageId, workflowKey, textValues, new HashMap<>(request.getFileMap()), instanceType);
    }

    @PostMapping("/webhooks/runninghub/{secret}")
    public void runningHubWebhook(@PathVariable String secret, @RequestBody(required = false) String body) {
        service.handleWebhook(secret, body);
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
