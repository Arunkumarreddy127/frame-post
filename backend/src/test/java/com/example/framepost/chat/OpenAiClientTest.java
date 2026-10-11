package com.example.framepost.chat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import com.example.framepost.config.OpenAiProperties;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

class OpenAiClientTest {

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
}
