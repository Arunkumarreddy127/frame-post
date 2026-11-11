package com.example.framepost.chat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.Base64;

import com.example.framepost.config.OpenAiProperties;
import com.example.framepost.storage.StorageService;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;

class OpenAiClientTest {

    @Test
    void sendsTextAndStoredImagesAndPdfsInResponsesInput() throws Exception {
    List<String> requests = new ArrayList<>();
    AtomicInteger requestNumber = new AtomicInteger();
    HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    server.createContext("/responses", exchange -> respondText(exchange, requests, requestNumber.getAndIncrement()));
    server.start();
    try {
        StorageService storage = org.mockito.Mockito.mock(StorageService.class);
        byte[] image = new byte[]{1, 2, 3};
        byte[] pdf = createPdf("Extracted PDF content");
        org.mockito.Mockito.when(storage.read("chats/user-id/image.png")).thenReturn(image);
        org.mockito.Mockito.when(storage.read("chats/user-id/document.pdf")).thenReturn(pdf);
        OpenAiClient client = new OpenAiClient(
            new OpenAiProperties("test-key", List.of("test-model"), 10),
            URI.create("http://localhost:" + server.getAddress().getPort() + "/responses"),
            storage
        );
        client.streamResponse(
            "test-model",
            "Developer context",
            List.of(new ChatMessage(
                "message-id", "conversation-id", ChatRole.USER, "Describe this", null,
                ChatMessageStatus.COMPLETED, java.time.Instant.now(),
            List.of(
                new ChatAttachment("image.png", "image/png", image.length, "chats/user-id/image.png"),
                new ChatAttachment("document.pdf", "application/pdf", pdf.length, "chats/user-id/document.pdf")))),
            false,
            ignored -> {},
            ignored -> ""
        );

        com.fasterxml.jackson.databind.JsonNode request = new com.fasterxml.jackson.databind.ObjectMapper()
            .readTree(requests.getFirst());
        com.fasterxml.jackson.databind.JsonNode content = request.path("input").get(1).path("content");
        assertEquals("input_text", content.get(0).path("type").asText());
        assertEquals("Describe this", content.get(0).path("text").asText());
        assertEquals("input_image", content.get(1).path("type").asText());
        assertEquals("data:image/png;base64," + Base64.getEncoder().encodeToString(image),
            content.get(1).path("image_url").asText());
        assertEquals("input_text", content.get(2).path("type").asText());
        assertEquals("PDF attachment \"document.pdf\":\n\nExtracted PDF content",
            content.get(2).path("text").asText());
        assertFalse(requests.getFirst().contains("input_file"));
        assertFalse(requests.getFirst().contains("file_data"));
    } finally {
        server.stop(0);
    }
    }

    @Test
    void rejectsPdfAttachmentsWithoutExtractableText() throws Exception {
        StorageService storage = org.mockito.Mockito.mock(StorageService.class);
        byte[] pdf = createPdf("");
        org.mockito.Mockito.when(storage.read("chats/user-id/scanned.pdf")).thenReturn(pdf);
        OpenAiClient client = new OpenAiClient(
                new OpenAiProperties("test-key", List.of("test-model"), 10),
                URI.create("http://localhost:1/responses"),
                storage);
        ChatMessage message = new ChatMessage(
                "message-id", "conversation-id", ChatRole.USER, "Summarize this", null,
                ChatMessageStatus.COMPLETED, java.time.Instant.now(),
                List.of(new ChatAttachment(
                        "scanned.pdf", "application/pdf", pdf.length, "chats/user-id/scanned.pdf")));

        OpenAiClient.OpenAiRequestException exception = assertThrows(
                OpenAiClient.OpenAiRequestException.class,
                () -> client.streamResponse(
                        "test-model", "Developer context", List.of(message), false, ignored -> {}, ignored -> ""));

        assertTrue(exception.getMessage().contains("Scanned PDFs require OCR"));
    }

    private static byte[] createPdf(String text) throws IOException {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            document.addPage(page);
            if (!text.isBlank()) {
                try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                    content.beginText();
                    content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                    content.newLineAtOffset(25, 700);
                    content.showText(text);
                    content.endText();
                }
            }
            document.save(output);
            return output.toByteArray();
        }
    }

    @Test
    void continuesAfterAReadToolCallWithTheAuthorizedOutput() throws Exception {
        List<String> requests = new ArrayList<>();
        AtomicInteger requestNumber = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/responses", exchange -> respond(exchange, requests, requestNumber.getAndIncrement()));
        server.start();
        try {
            OpenAiClient client = new OpenAiClient(
                    new OpenAiProperties("test-key", List.of("test-model"), 10),
                    URI.create("http://localhost:" + server.getAddress().getPort() + "/responses")
            );
            StringBuilder response = new StringBuilder();
            List<OpenAiClient.ToolCall> toolCalls = new ArrayList<>();

            client.streamResponse(
                    "test-model",
                    "Developer context",
                    List.of(),
                    true,
                    response::append,
                    call -> {
                        toolCalls.add(call);
                        return "{\"file_id\":\"file-1\",\"content\":\"Read content\"}";
                    }
            );

            assertEquals("Answer based on the file.", response.toString());
            assertEquals(1, toolCalls.size());
            assertTrue(requests.get(0).contains("\"role\":\"developer\""));
            assertTrue(requests.get(1).contains("\"previous_response_id\":\"response-1\""));
            assertTrue(requests.get(1).contains("\"type\":\"function_call_output\""));
            assertTrue(requests.get(1).contains("\"call_id\":\"call-1\""));
            assertTrue(requests.get(1).contains("Read content"));
        } finally {
            server.stop(0);
        }
    }

    private static void respond(HttpExchange exchange, List<String> requests, int requestNumber) throws IOException {
        requests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        String body = requestNumber == 0
                ? """
                        data: {"type":"response.created","response":{"id":"response-1"}}

                        data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"call-1","name":"read_selected_instruction_file","arguments":"{\\"file_id\\":\\"file-1\\"}"}}

                        data: [DONE]

                        """
                : """
                        data: {"type":"response.created","response":{"id":"response-2"}}

                        data: {"type":"response.output_text.delta","delta":"Answer based on the file."}

                        data: [DONE]

                        """;
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static void respondText(HttpExchange exchange, List<String> requests, int requestNumber) throws IOException {
        requests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        byte[] bytes = ("data: {\"type\":\"response.created\",\"response\":{\"id\":\"response-" + requestNumber + "\"}}\n\n"
                + "data: {\"type\":\"response.output_text.delta\",\"delta\":\"ok\"}\n\n"
                + "data: [DONE]\n\n").getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/event-stream");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
