package com.example.framepost.image;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import com.example.framepost.config.ImageProperties;
import com.example.framepost.config.OpenAiProperties;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

class OpenAiImageClientTest {

    @Test
    void sendsInputImagesAsMultipartEditRequest() throws IOException {
        AtomicReference<String> path = new AtomicReference<>();
        AtomicReference<String> contentType = new AtomicReference<>();
        AtomicReference<String> body = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            path.set(exchange.getRequestURI().getPath());
            contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            try (InputStream in = exchange.getRequestBody()) {
                body.set(new String(in.readAllBytes(), StandardCharsets.ISO_8859_1));
            }
            byte[] response = "{\"data\":[{\"b64_json\":\"AQ==\"}]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(response);
            }
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/images";
            var client = new OpenAiImageClient(new OpenAiProperties("key", List.of("m"), 10), new ImageProperties(List.of("m"), 10), base);
            var request = new OpenAiImageClient.ImageRequest("m", "a cat", 1, "auto", null, "png", "auto", "auto");
            var input = new OpenAiImageClient.InputImage("image-1.png", "image/png", new byte[] {7, 8, 9});

            List<byte[]> images = client.generate(request, List.of(input));

            assertEquals("/v1/images/edits", path.get());
            assertTrue(contentType.get().startsWith("multipart/form-data; boundary="));
            assertTrue(body.get().contains("name=\"image[]\"; filename=\"image-1.png\""), body.get());
            assertTrue(body.get().contains("Content-Type: image/png"));
            assertEquals(1, images.size());
        } finally {
            server.stop(0);
        }
    }
}
