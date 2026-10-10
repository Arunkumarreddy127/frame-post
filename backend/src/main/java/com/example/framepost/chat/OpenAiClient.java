package com.example.framepost.chat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Iterator;
import java.util.function.Consumer;
import java.util.stream.Stream;

import com.example.framepost.config.OpenAiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class OpenAiClient {

    private static final URI RESPONSES_URI = URI.create("https://api.openai.com/v1/responses");

    static final String INSTRUCTION_UPDATE_TOOL = "propose_instruction_update";
    static final String INSTRUCTION_CREATE_TOOL = "create_instruction_file";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final OpenAiProperties properties;

    public OpenAiClient(OpenAiProperties properties) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.objectMapper = new ObjectMapper();
        this.properties = properties;
    }

    public void streamResponse(
            String model,
            String developerInstructions,
            List<ChatMessage> messages,
            boolean offerInstructionTool,
            Consumer<String> onDelta,
            Consumer<FunctionCall> onFunctionCall
    ) {
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "OpenAI is not configured");
        }

        HttpRequest request = HttpRequest.newBuilder(RESPONSES_URI)
                .timeout(Duration.ofSeconds(properties.requestTimeoutSeconds()))
                .header("Authorization", "Bearer " + properties.apiKey())
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody(model, developerInstructions, messages, offerInstructionTool)))
                .build();

        try {
            HttpResponse<Stream<String>> response = httpClient.send(request, HttpResponse.BodyHandlers.ofLines());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                try (Stream<String> lines = response.body()) {
                    String body = lines.reduce("", (current, line) -> current + line);
                    throw new OpenAiRequestException(providerError(body));
                }
            }

            try (Stream<String> lines = response.body()) {
                consumeEvents(lines, onDelta, onFunctionCall);
            }
        } catch (IOException exception) {
            throw new OpenAiRequestException("Unable to reach OpenAI", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new OpenAiRequestException("OpenAI request was interrupted", exception);
        }
    }

    private String requestBody(
            String model,
            String developerInstructions,
            List<ChatMessage> messages,
            boolean offerInstructionTool
    ) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("model", model);
        payload.put("stream", true);
        ArrayNode input = payload.putArray("input");
        input.addObject()
                .put("role", "developer")
                .put("content", developerInstructions);
        for (ChatMessage message : messages) {
            input.addObject()
                    .put("role", message.role() == ChatRole.USER ? "user" : "assistant")
                    .put("content", message.content());
        }

        if (offerInstructionTool) {
            ArrayNode tools = payload.putArray("tools");
            
            // Tool 1: Update existing instruction file
            ObjectNode updateTool = tools.addObject();
            updateTool.put("type", "function");
            updateTool.put("name", INSTRUCTION_UPDATE_TOOL);
            updateTool.put("description", "Propose a replacement for the full content of one selected instruction file. "
                    + "The user must approve it before it is saved.");
            ObjectNode updateParams = updateTool.putObject("parameters");
            updateParams.put("type", "object");
            ObjectNode updateProps = updateParams.putObject("properties");
            updateProps.putObject("file_id").put("type", "string").put("description", "The id of the instruction file");
            updateProps.putObject("content").put("type", "string").put("description", "The complete new file content");
            updateParams.putArray("required").add("file_id").add("content");
            updateParams.put("additionalProperties", false);
            
            // Tool 2: Create new instruction file
            ObjectNode createTool = tools.addObject();
            createTool.put("type", "function");
            createTool.put("name", INSTRUCTION_CREATE_TOOL);
            createTool.put("description", "Create a new instruction file. The user must approve it before it is saved.");
            ObjectNode createParams = createTool.putObject("parameters");
            createParams.put("type", "object");
            ObjectNode createProps = createParams.putObject("properties");
            createProps.putObject("name").put("type", "string").put("description", "The name of the instruction file (1-100 characters)");
            createProps.putObject("content").put("type", "string").put("description", "The complete file content (1-20000 characters)");
            createParams.putArray("required").add("name").add("content");
            createParams.put("additionalProperties", false);
        }

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to create OpenAI request", exception);
        }
    }

    private void consumeEvents(Stream<String> lines, Consumer<String> onDelta, Consumer<FunctionCall> onFunctionCall) {
        StringBuilder data = new StringBuilder();
        Iterator<String> iterator = lines.iterator();
        while (iterator.hasNext()) {
            String line = iterator.next();
            if (line.isEmpty()) {
                consumeEvent(data.toString(), onDelta, onFunctionCall);
                data.setLength(0);
            } else if (line.startsWith("data:")) {
                if (!data.isEmpty()) {
                    data.append('\n');
                }
                data.append(line.substring(5).trim());
            }
        }
        consumeEvent(data.toString(), onDelta, onFunctionCall);
    }

    private void consumeEvent(String data, Consumer<String> onDelta, Consumer<FunctionCall> onFunctionCall) {
        if (data.isBlank() || "[DONE]".equals(data)) {
            return;
        }

        try {
            JsonNode event = objectMapper.readTree(data);
            String type = event.path("type").asText();
            if ("response.output_text.delta".equals(type)) {
                onDelta.accept(event.path("delta").asText());
            } else if ("response.output_item.done".equals(type)
                    && "function_call".equals(event.path("item").path("type").asText())) {
                onFunctionCall.accept(new FunctionCall(
                        event.path("item").path("name").asText(),
                        event.path("item").path("arguments").asText()
                ));
            } else if ("error".equals(type) || "response.failed".equals(type)) {
                throw new OpenAiRequestException(providerError(event));
            }
        } catch (IOException exception) {
            throw new OpenAiRequestException("Received an invalid response from OpenAI", exception);
        }
    }

    private String providerError(String body) {
        try {
            return providerError(objectMapper.readTree(body));
        } catch (IOException ignored) {
            return "OpenAI could not complete the request";
        }
    }

    private String providerError(JsonNode response) {
        String message = response.path("error").path("message").asText();
        if (message.isBlank()) {
            message = response.path("message").asText();
        }
        return message.isBlank() ? "OpenAI could not complete the request" : message;
    }

    public record FunctionCall(String name, String arguments) {
    }

    public static class OpenAiRequestException extends RuntimeException {

        OpenAiRequestException(String message) {
            super(message);
        }

        OpenAiRequestException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
