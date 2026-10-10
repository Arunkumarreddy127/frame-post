package com.example.framepost.chat;

import java.util.List;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import com.example.framepost.auth.AuthService;
import com.example.framepost.auth.User;
import com.example.framepost.chat.ChatService.ChatConversationResponse;
import com.example.framepost.chat.ChatService.ChatConversationSummary;
import com.example.framepost.chat.ChatService.CreateConversationRequest;
import com.example.framepost.chat.ChatService.SendMessageRequest;
import com.example.framepost.chat.ChatService.UpdateConversationTitleRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ChatController {

    private static final String COOKIE_NAME = "framepost_session";

    private final ChatService chatService;
    private final AuthService authService;

    public ChatController(ChatService chatService, AuthService authService) {
        this.chatService = chatService;
        this.authService = authService;
    }

    @GetMapping("/chats")
    public List<ChatConversationSummary> listGlobal(HttpServletRequest request) {
        return chatService.list(currentUser(request), null);
    }

    @GetMapping("/chats/all")
    public List<ChatConversationSummary> listAll(HttpServletRequest request) {
        return chatService.listAll(currentUser(request));
    }

    @GetMapping("/chat/models")
    public List<String> listModels(HttpServletRequest request) {
        currentUser(request);
        return chatService.availableModels();
    }

    @PostMapping("/chats")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatConversationResponse createGlobal(
            @RequestBody CreateConversationRequest request,
            HttpServletRequest servletRequest
    ) {
        return chatService.create(currentUser(servletRequest), null, request);
    }

    @GetMapping("/chats/{conversationId}")
    public ChatConversationResponse getGlobal(
            @PathVariable String conversationId,
            HttpServletRequest request
    ) {
        return chatService.get(currentUser(request), null, conversationId);
    }

    @PatchMapping("/chats/{conversationId}")
    public ChatConversationResponse updateGlobalTitle(
            @PathVariable String conversationId,
            @RequestBody UpdateConversationTitleRequest request,
            HttpServletRequest servletRequest
    ) {
        return chatService.updateTitle(currentUser(servletRequest), null, conversationId, request);
    }

    @DeleteMapping("/chats/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGlobal(@PathVariable String conversationId, HttpServletRequest request) {
        chatService.delete(currentUser(request), null, conversationId);
    }

    @PostMapping(value = "/chats/{conversationId}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamGlobal(
            @PathVariable String conversationId,
            @RequestBody SendMessageRequest request,
            HttpServletRequest servletRequest
    ) {
        return chatService.streamMessage(currentUser(servletRequest), null, conversationId, request);
    }

    @GetMapping("/pages/{pageId}/chats")
    public List<ChatConversationSummary> listForPage(
            @PathVariable String pageId,
            HttpServletRequest request
    ) {
        return chatService.list(currentUser(request), pageId);
    }

    @PostMapping("/pages/{pageId}/chats")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatConversationResponse createForPage(
            @PathVariable String pageId,
            @RequestBody CreateConversationRequest request,
            HttpServletRequest servletRequest
    ) {
        return chatService.create(currentUser(servletRequest), pageId, request);
    }

    @GetMapping("/pages/{pageId}/chats/{conversationId}")
    public ChatConversationResponse getForPage(
            @PathVariable String pageId,
            @PathVariable String conversationId,
            HttpServletRequest request
    ) {
        return chatService.get(currentUser(request), pageId, conversationId);
    }

    @PatchMapping("/pages/{pageId}/chats/{conversationId}")
    public ChatConversationResponse updateForPageTitle(
            @PathVariable String pageId,
            @PathVariable String conversationId,
            @RequestBody UpdateConversationTitleRequest request,
            HttpServletRequest servletRequest
    ) {
        return chatService.updateTitle(currentUser(servletRequest), pageId, conversationId, request);
    }

    @DeleteMapping("/pages/{pageId}/chats/{conversationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteForPage(
            @PathVariable String pageId,
            @PathVariable String conversationId,
            HttpServletRequest request
    ) {
        chatService.delete(currentUser(request), pageId, conversationId);
    }

    @PostMapping(
            value = "/pages/{pageId}/chats/{conversationId}/messages/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter streamForPage(
            @PathVariable String pageId,
            @PathVariable String conversationId,
            @RequestBody SendMessageRequest request,
            HttpServletRequest servletRequest
    ) {
        return chatService.streamMessage(currentUser(servletRequest), pageId, conversationId, request);
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
