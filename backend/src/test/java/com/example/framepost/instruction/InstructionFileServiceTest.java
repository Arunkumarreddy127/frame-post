package com.example.framepost.instruction;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import com.example.framepost.auth.User;
import com.example.framepost.page.PageService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.web.server.ResponseStatusException;

class InstructionFileServiceTest {

    private final InstructionFileRepository files = Mockito.mock(InstructionFileRepository.class);
    private final PageService pageService = Mockito.mock(PageService.class);
    private final InstructionFileService service = new InstructionFileService(files, pageService);
    private final User user = new User("user-id", "framepost", "hash", Instant.now());
    private final Instant now = Instant.now();

    @Test
    void rejectsDuplicateNamesInTheSameScope() {
        when(files.existsByUserIdAndPageIdIsNullAndNameIgnoreCase("user-id", "Tone")).thenReturn(true);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.create(user, null, new InstructionFileService.InstructionFileRequest("Tone", "x"))
        );

        assertEquals(409, exception.getStatusCode().value());
    }

    @Test
    void rejectsSelectionOfAnotherPagesFile() {
        InstructionFile other = new InstructionFile("f1", "user-id", "page-b", "A", "x", now, now);
        when(files.findByIdInAndUserId(List.of("f1"), "user-id")).thenReturn(List.of(other));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.validateSelection(user, "page-a", List.of("f1"))
        );

        assertEquals(400, exception.getStatusCode().value());
    }

    @Test
    void resolveSkipsMissingAndOutOfScopeFilesAndKeepsOrder() {
        InstructionFile userFile = new InstructionFile("f1", "user-id", null, "A", "x", now, now);
        InstructionFile pageFile = new InstructionFile("f2", "user-id", "page-a", "B", "y", now, now);
        InstructionFile otherPage = new InstructionFile("f3", "user-id", "page-b", "C", "z", now, now);
        List<String> ids = List.of("f2", "gone", "f3", "f1");
        when(files.findByIdInAndUserId(ids, "user-id")).thenReturn(List.of(userFile, pageFile, otherPage));

        assertEquals(List.of(pageFile, userFile), service.resolveSelected("user-id", "page-a", ids));
    }

    @Test
    void validatesSelectionAndDeduplicates() {
        InstructionFile userFile = new InstructionFile("f1", "user-id", null, "A", "x", now, now);
        when(files.findByIdInAndUserId(List.of("f1"), "user-id")).thenReturn(List.of(userFile));

        assertEquals(List.of("f1"), service.validateSelection(user, null, List.of("f1", "f1")));
    }

    @Test
    void updateCanMovePageFileToAllChats() {
        InstructionFile pageFile = new InstructionFile("f1", "user-id", "page-a", "Tone", "old", now, now);
        when(files.findByIdAndUserId("f1", "user-id")).thenReturn(Optional.of(pageFile));
        when(files.save(Mockito.any())).thenAnswer(invocation -> invocation.getArgument(0));

        InstructionFile updated = service.update(
                user,
                "f1",
                new InstructionFileService.InstructionFileUpdateRequest("Tone", "new", "user", null)
        );

        assertNull(updated.pageId());
        assertEquals("new", updated.content());
    }

    @Test
    void updateCanMoveUserFileIntoCurrentPage() {
        InstructionFile userFile = new InstructionFile("f1", "user-id", null, "Tone", "old", now, now);
        when(files.findByIdAndUserId("f1", "user-id")).thenReturn(Optional.of(userFile));
        when(files.save(Mockito.any())).thenAnswer(invocation -> invocation.getArgument(0));

        InstructionFile updated = service.update(
                user,
                "f1",
                new InstructionFileService.InstructionFileUpdateRequest("Tone", "new", "page", "page-a")
        );

        assertEquals("page-a", updated.pageId());
        Mockito.verify(pageService).get(user, "page-a");
    }

    @Test
    void updateRejectsDuplicateNameInDestinationScope() {
        InstructionFile pageFile = new InstructionFile("f1", "user-id", "page-a", "Tone", "old", now, now);
        when(files.findByIdAndUserId("f1", "user-id")).thenReturn(Optional.of(pageFile));
        when(files.existsByUserIdAndPageIdIsNullAndNameIgnoreCase("user-id", "Tone")).thenReturn(true);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.update(
                        user,
                        "f1",
                        new InstructionFileService.InstructionFileUpdateRequest("Tone", "new", "user", null)
                )
        );

        assertEquals(409, exception.getStatusCode().value());
    }
}
