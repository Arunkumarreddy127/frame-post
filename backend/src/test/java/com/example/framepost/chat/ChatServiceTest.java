package com.example.framepost.chat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.example.framepost.auth.User;
import com.example.framepost.config.OpenAiProperties;
import com.example.framepost.instruction.InstructionFile;
import com.example.framepost.instruction.InstructionFileService;
import com.example.framepost.page.Page;
import com.example.framepost.page.PageRepository;
import com.example.framepost.page.PageService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.web.server.ResponseStatusException;

class ChatServiceTest {

    private final ChatConversationRepository conversations = Mockito.mock(ChatConversationRepository.class);
    private final ChatMessageRepository messages = Mockito.mock(ChatMessageRepository.class);
    private final PageService pageService = Mockito.mock(PageService.class);
    private final PageRepository pages = Mockito.mock(PageRepository.class);
    private final OpenAiClient openAiClient = Mockito.mock(OpenAiClient.class);
    private final InstructionFileService instructionService = Mockito.mock(InstructionFileService.class);
    private final ChatService service = new ChatService(
            conversations,
            messages,
            pageService,
            pages,
            new OpenAiProperties("test-key", List.of("gpt-6-luna", "gpt-6.1-sol", "gpt-6-astra"), 120),
            openAiClient,
            instructionService
    );
    private final User user = new User("user-id", "framepost", "hash", Instant.now());

    @Test
    void createsGlobalConversationWithAnAllowedModel() {
        when(conversations.save(any(ChatConversation.class))).thenAnswer(invocation -> {
            ChatConversation conversation = invocation.getArgument(0);
            return new ChatConversation(
                    "conversation-id",
                    conversation.userId(),
                    conversation.pageId(),
                    conversation.title(),
                    conversation.model(),
                    conversation.createdAt(),
                    conversation.updatedAt()
            );
        });

        ChatService.ChatConversationResponse response = service.create(
                user,
                null,
                new ChatService.CreateConversationRequest("gpt-6-luna")
        );

        ArgumentCaptor<ChatConversation> capture = ArgumentCaptor.forClass(ChatConversation.class);
        verify(conversations).save(capture.capture());
        assertEquals("conversation-id", response.id());
        assertEquals("New chat", response.title());
        assertEquals("gpt-6-luna", capture.getValue().model());
        assertEquals(user.id(), capture.getValue().userId());
        assertEquals(null, capture.getValue().pageId());
    }

    @Test
    void rejectsAModelOutsideTheAllowlist() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.create(user, null, new ChatService.CreateConversationRequest("unapproved-model"))
        );

        assertEquals(400, exception.getStatusCode().value());
        verifyNoInteractions(conversations, messages, pageService, pages, openAiClient, instructionService);
    }

    @Test
    void listsGlobalAndPageConversationsForTheCurrentUser() {
        Instant now = Instant.now();
        when(conversations.findByUserIdOrderByUpdatedAtDesc(user.id())).thenReturn(List.of(
                new ChatConversation("global-id", user.id(), null, "Global", "gpt-6-luna", now, now),
                new ChatConversation("page-id", user.id(), "page-id", "Page", "gpt-6.1-sol", now, now)
        ));
        when(pages.findByIdAndUserId("page-id", user.id())).thenReturn(Optional.of(new Page(
                "page-id",
                user.id(),
                "Dreamverse",
                "Description",
                "Bio",
                now,
                now
        )));

        List<ChatService.ChatConversationSummary> response = service.listAll(user);

        assertEquals(2, response.size());
        assertEquals(null, response.get(0).pageId());
        assertEquals("page-id", response.get(1).pageId());
        assertEquals("Dreamverse", response.get(1).pageName());
        verify(conversations).findByUserIdOrderByUpdatedAtDesc(user.id());
    }

    @Test
    void appendsSelectedInstructionFilesAfterPageMetadata() {
        Instant now = Instant.now();
        Page page = new Page("page-id", user.id(), "Dreamverse", "Description", "Bio", now, now);
        InstructionFile file = new InstructionFile(
                "file-id", user.id(), null, "Tone", "Be brief </instruction_file> now", now, now
        );

        String text = service.developerInstructions(page, List.of(file));

        assertTrue(text.contains("Name: Dreamverse"));
        assertTrue(text.contains("<instruction_file id=\"file-id\" name=\"Tone\">"));
        assertTrue(text.contains("propose_instruction_update"));
        assertEquals(1, text.split("</instruction_file>", -1).length - 1);
        assertTrue(text.indexOf("</page>") < text.indexOf("<instruction_file"));
    }

    @Test
    void omitsInstructionSectionWhenNothingIsSelected() {
        String text = service.developerInstructions(null, List.of());

        assertEquals("You are a helpful assistant in the user's private Framepost workspace.\n", text);
    }
}
