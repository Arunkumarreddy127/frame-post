package com.example.framepost.image;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import com.example.framepost.config.ImageProperties;
import com.example.framepost.config.OpenAiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class OpenAiImageClient {

    private static final String DEFAULT_BASE = "https://api.openai.com/v1/images";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final OpenAiProperties openAi;
    private final ImageProperties image;
    private final String baseUrl;

    @Autowired
    public OpenAiImageClient(OpenAiProperties openAi, ImageProperties image) {
        this(openAi, image, DEFAULT_BASE);
    }

    OpenAiImageClient(OpenAiProperties openAi, ImageProperties image, String baseUrl) {
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
        this.openAi = openAi;
        this.image = image;
        this.baseUrl = baseUrl;
    }

    public List<byte[]> generate(ImageRequest request, List<InputImage> inputs) {
        if (openAi.apiKey() == null || openAi.apiKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "OpenAI is not configured");
        }
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .timeout(Duration.ofSeconds(image.requestTimeoutSeconds()))
                    .header("Authorization", "Bearer " + openAi.apiKey());
            if (inputs.isEmpty()) {
                builder.uri(URI.create(baseUrl + "/generations"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody(request)));
            } else {
                String boundary = "framepost-" + UUID.randomUUID();
                builder.uri(URI.create(baseUrl + "/edits"))
                        .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                        .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody(request, inputs, boundary)));
            }
            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode body = readTree(response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String message = body.path("error").path("message").asText();
                throw new ImageRequestException(message.isBlank() ? "OpenAI could not generate the images" : message);
            }
            List<byte[]> images = new ArrayList<>();
            for (JsonNode item : body.path("data")) {
                String encoded = item.path("b64_json").asText();
                if (!encoded.isBlank()) {
                    images.add(Base64.getDecoder().decode(encoded));
                }
            }
            if (images.isEmpty()) {
                throw new ImageRequestException("OpenAI returned no images");
            }
            return images;
        } catch (IOException exception) {
            throw new ImageRequestException("Unable to reach OpenAI", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ImageRequestException("OpenAI request was interrupted", exception);
        }
    }

    private JsonNode readTree(String body) {
        try {
            return objectMapper.readTree(body == null ? "" : body);
        } catch (IOException exception) {
            throw new ImageRequestException("Received an invalid response from OpenAI", exception);
        }
    }

    private String jsonBody(ImageRequest request) throws IOException {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("model", request.model());
        payload.put("prompt", request.prompt());
        payload.put("n", request.count());
        payload.put("size", request.size());
        payload.put("output_format", request.outputFormat());
        payload.put("background", request.background());
        payload.put("moderation", request.moderation());
        if (request.quality() != null) {
            payload.put("quality", request.quality());
        }
        return objectMapper.writeValueAsString(payload);
    }

    private byte[] multipartBody(ImageRequest request, List<InputImage> inputs, String boundary) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        field(out, boundary, "model", request.model());
        field(out, boundary, "prompt", request.prompt());
        field(out, boundary, "n", String.valueOf(request.count()));
        field(out, boundary, "size", request.size());
        field(out, boundary, "output_format", request.outputFormat());
        field(out, boundary, "background", request.background());
        field(out, boundary, "moderation", request.moderation());
        if (request.quality() != null) {
            field(out, boundary, "quality", request.quality());
        }
        for (InputImage input : inputs) {
            out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"image[]\"; filename=\""
                    + input.filename() + "\"\r\nContent-Type: " + input.contentType() + "\r\n\r\n")
                    .getBytes(StandardCharsets.UTF_8));
            out.write(input.bytes());
            out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private void field(ByteArrayOutputStream out, String boundary, String name, String value) throws IOException {
        out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"
                + value + "\r\n").getBytes(StandardCharsets.UTF_8));
    }

    public record ImageRequest(
            String model,
            String prompt,
            int count,
            String size,
            String quality,
            String outputFormat,
            String background,
            String moderation
    ) {
    }

    public record InputImage(String filename, String contentType, byte[] bytes) {
    }

    public static class ImageRequestException extends RuntimeException {

        ImageRequestException(String message) {
            super(message);
        }

        ImageRequestException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
