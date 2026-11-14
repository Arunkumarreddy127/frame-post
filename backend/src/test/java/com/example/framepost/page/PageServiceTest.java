package com.example.framepost.page;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import com.example.framepost.auth.User;
import com.example.framepost.instruction.InstructionFileRepository;
import com.example.framepost.storage.StorageService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

class PageServiceTest {

    private final PageRepository pages = Mockito.mock(PageRepository.class);
    private final InstructionFileRepository instructionFiles = Mockito.mock(InstructionFileRepository.class);
    private final StorageService storage = Mockito.mock(StorageService.class);
    private final PageService service = new PageService(pages, instructionFiles, storage);
    private final User user = new User("user-id", "framepost", "hash", Instant.now());

    @Test
    void createsPageWithUploadedProfileImageAndPublicUrl() {
        MockMultipartFile image = new MockMultipartFile(
                "profileImage", "avatar.png", "image/png", new byte[] {1, 2, 3});
        when(pages.save(any(Page.class))).thenAnswer(invocation -> {
            Page page = invocation.getArgument(0);
            return new Page(
                    "page-id", page.userId(), page.name(), page.description(), page.bio(),
                    page.profileImageKey(), page.createdAt(), page.updatedAt());
        });
        when(storage.publicUrl(anyString()))
                .thenReturn("https://cdn.example.com/avatar.png");

        Page page = service.create(user, new PageService.PageRequest("Page", "Description", "Bio"), image);
        PageService.PageResponse response = service.toResponse(page);

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(storage).store(key.capture(), any(), eq(3L), eq("image/png"));
        assertTrue(key.getValue().startsWith("page-avatars/user-id/"));
        assertEquals("https://cdn.example.com/avatar.png", response.profileImageUrl());
    }

    @Test
    void retainsExistingProfileImageWhenEditingWithoutAnUpload() {
        Instant now = Instant.now();
        Page existing = new Page("page-id", user.id(), "Old", "Description", "Bio", "avatar-key", now, now);
        when(pages.findByIdAndUserId(existing.id(), user.id())).thenReturn(Optional.of(existing));
        when(pages.save(any(Page.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Page updated = service.update(
                user,
                existing.id(),
                new PageService.PageRequest("New", "Updated description", "Updated bio"),
                null,
                false);

        assertEquals("avatar-key", updated.profileImageKey());
        verifyNoInteractions(storage);
    }

    @Test
    void removesExistingProfileImageWhenRequested() {
        Instant now = Instant.now();
        Page existing = new Page("page-id", user.id(), "Page", "Description", "Bio", "avatar-key", now, now);
        when(pages.findByIdAndUserId(existing.id(), user.id())).thenReturn(Optional.of(existing));
        when(pages.save(any(Page.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Page updated = service.update(
                user,
                existing.id(),
                new PageService.PageRequest("Page", "Description", "Bio"),
                null,
                true);

        assertNull(updated.profileImageKey());
        verify(storage).delete("avatar-key");
    }
}
