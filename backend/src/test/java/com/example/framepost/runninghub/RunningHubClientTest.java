package com.example.framepost.runninghub;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import com.example.framepost.config.RunningHubProperties;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RunningHubClientTest {

    private HttpServer server;
    private final AtomicReference<String> lastPath = new AtomicReference<>();
    private final AtomicReference<String> lastBody = new AtomicReference<>();
    private final AtomicReference<String> response = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            lastPath.set(exchange.getRequestURI().getPath());
            lastBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] bytes = response.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void createTaskSendsEveryNodeInfoEntryAsGiven() {
        response.set("{\"code\":0,\"msg\":\"success\",\"data\":{\"taskId\":\"task-9\"}}");
        RunningHubClient client = client();
        List<NodeInfo> nodes = List.of(
                new NodeInfo("236", "image", "api/frame.png"),
                new NodeInfo("222", "width", "768"));

        assertEquals("task-9", client.createTask("workflow-1", nodes, null, null));

        assertEquals("/task/openapi/create", lastPath.get());
        assertTrue(lastBody.get().contains("\"workflowId\":\"workflow-1\""));
        assertFalse(lastBody.get().contains("webhookUrl"));
        assertFalse(lastBody.get().contains("instanceType"));
        assertTrue(lastBody.get().contains(
                "{\"nodeId\":\"236\",\"fieldName\":\"image\",\"fieldValue\":\"api/frame.png\"}"));
        assertTrue(lastBody.get().contains(
                "{\"nodeId\":\"222\",\"fieldName\":\"width\",\"fieldValue\":\"768\"}"));
    }

    @Test
    void createTaskRegistersWebhookUrlWhenProvided() {
        response.set("{\"code\":0,\"msg\":\"success\",\"data\":{\"taskId\":\"task-9\"}}");

        client().createTask("workflow-1", List.of(), "https://example.test/api/webhooks/runninghub/s", null);

        assertTrue(lastBody.get().contains(
                "\"webhookUrl\":\"https://example.test/api/webhooks/runninghub/s\""));
    }

    @Test
    void createTaskIncludesInstanceTypeWhenProvided() {
        response.set("{\"code\":0,\"msg\":\"success\",\"data\":{\"taskId\":\"task-9\"}}");

        client().createTask("workflow-1", List.of(), null, "plus");

        assertTrue(lastBody.get().contains("\"instanceType\":\"plus\""));
    }

    @Test
    void failedResponseCodeRaisesRunningHubException() {
        response.set("{\"code\":421,\"msg\":\"insufficient balance\",\"data\":null}");

        RunningHubException exception = assertThrows(RunningHubException.class,
                () -> client().taskStatus("task-9"));
        assertEquals("RunningHub request failed: insufficient balance", exception.getMessage());
    }

    @Test
    void blankWorkflowIdIsRejectedBeforeCallingRunningHub() {
        assertThrows(RunningHubException.class,
                () -> client().createTask(" ", List.of(), null, null));
        assertEquals(null, lastPath.get());
    }

    private RunningHubClient client() {
        String base = "http://127.0.0.1:" + server.getAddress().getPort();
        return new RunningHubClient(new RunningHubProperties(
                "key", base, 10, 1, 60, "", ""));
    }
}
