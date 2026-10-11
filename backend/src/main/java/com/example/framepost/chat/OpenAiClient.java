package com.example.framepost.chat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Iterator;
import java.util.stream.Stream;
import java.util.function.Consumer;

import com.example.framepost.config.OpenAiProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class OpenAiClient {

    private static final URI DEFAULT_RESPONSES_URI = URI.create("https://api.openai.com/v1/responses");

    static final String INSTRUCTION_UPDATE_TOOL = "propose_instruction_update";
    static final String INSTRUCTION_CREATE_TOOL = "create_instruction_file";
    static final String INSTRUCTION_READ_TOOL = "read_selected_instruction_file";
    private static final int MAX_TOOL_CONTINUATIONS = 5;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final OpenAiProperties properties;
    private final URI responsesUri;

    @Autowired
    public OpenAiClient(OpenAiProperties properties) {
        this(properties, DEFAULT_RESPONSES_URI);
    }

    OpenAiClient(OpenAiProperties properties, URI responsesUri) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.objectMapper = new ObjectMapper();
        this.properties = properties;
        this.responsesUri = responsesUri;
    }

    public void streamResponse(
            String model,
            String developerInstructions,
            List<ChatMessage> messages,
            boolean offerInstructionTool,
            Consumer<String> onDelta,
            ToolCallHandler onToolCall
    ) {
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "OpenAI is not configured");
        }

        try {
            String previousResponseId = null;
            List<ToolOutput> toolOutputs = List.of();
            for (int continuation = 0; ; continuation++) {
                StreamResult result = stream(
                        model,
                        developerInstructions,
                        messages,
                        offerInstructionTool,
                        previousResponseId,
                        toolOutputs,
                        onDelta
                );
                if (result.toolCalls().isEmpty()) {
                    return;
                }
                if (continuation >= MAX_TOOL_CONTINUATIONS) {
                    throw new OpenAiRequestException("The assistant exceeded the instruction retrieval limit");
                }
                if (result.responseId() == null || result.responseId().isBlank()) {
                    throw new OpenAiRequestException("OpenAI did not identify the response that requested a tool");
                }
                previousResponseId = result.responseId();
                toolOutputs = result.toolCalls().stream()
                        .map(call -> new ToolOutput(call.callId(), onToolCall.handle(call)))
                        .toList();
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
            boolean offerInstructionTool,
            String previousResponseId,
            List<ToolOutput> toolOutputs
    ) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("model", model);
        payload.put("stream", true);
        ArrayNode input = payload.putArray("input");
        if (previousResponseId == null) {
            input.addObject()
                    .put("role", "developer")
                    .put("content", developerInstructions);
            for (ChatMessage message : messages) {
                input.addObject()
                        .put("role", message.role() == ChatRole.USER ? "user" : "assistant")
                        .put("content", message.content());
            }
        } else {
            payload.put("previous_response_id", previousResponseId);
            for (ToolOutput output : toolOutputs) {
                input.addObject()
                        .put("type", "function_call_output")
                        .put("call_id", output.callId())
                        .put("output", output.output());
            }
        }

        if (offerInstructionTool) {
            ArrayNode tools = payload.putArray("tools");

            ObjectNode readTool = tools.addObject();
            readTool.put("type", "function");
            readTool.put("name", INSTRUCTION_READ_TOOL);
            readTool.put("description", "Read the complete content of a selected instruction file when it is relevant "
                    + "to answering the user. You may only request files from the selected-file catalog.");
            ObjectNode readParams = readTool.putObject("parameters");
            readParams.put("type", "object");
            ObjectNode readProps = readParams.putObject("properties");
            readProps.putObject("file_id").put("type", "string").put("description", "The selected instruction file id");
            readParams.putArray("required").add("file_id");
            readParams.put("additionalProperties", false);

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

    private StreamResult stream(
            String model,
            String developerInstructions,
            List<ChatMessage> messages,
            boolean offerInstructionTool,
            String previousResponseId,
            List<ToolOutput> toolOutputs,
            Consumer<String> onDelta
    ) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(responsesUri)
                .timeout(Duration.ofSeconds(properties.requestTimeoutSeconds()))
                .header("Authorization", "Bearer " + properties.apiKey())
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(
                        requestBody(model, developerInstructions, messages, offerInstructionTool, previousResponseId, toolOutputs)
                ))
                .build();
        HttpResponse<Stream<String>> response = httpClient.send(request, HttpResponse.BodyHandlers.ofLines());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            try (Stream<String> lines = response.body()) {
                String body = lines.reduce("", (current, line) -> current + line);
                throw new OpenAiRequestException(providerError(body));
            }
        }
        try (Stream<String> lines = response.body()) {
            return consumeEvents(lines, onDelta);
        }
    }

    private StreamResult consumeEvents(Stream<String> lines, Consumer<String> onDelta) {
        StringBuilder data = new StringBuilder();
        StreamResultBuilder result = new StreamResultBuilder();
        Iterator<String> iterator = lines.iterator();
        while (iterator.hasNext()) {
            String line = iterator.next();
            if (line.isEmpty()) {
                consumeEvent(data.toString(), onDelta, result);
                data.setLength(0);
            } else if (line.startsWith("data:")) {
                if (!data.isEmpty()) {
                    data.append('\n');
                }
                data.append(line.substring(5).trim());
            }
        }
        consumeEvent(data.toString(), onDelta, result);
        return result.build();
    }

    private void consumeEvent(String data, Consumer<String> onDelta, StreamResultBuilder result) {
        if (data.isBlank() || "[DONE]".equals(data)) {
            return;
        }

        try {
            JsonNode event = objectMapper.readTree(data);
            String type = event.path("type").asText();
            String responseId = event.path("response").path("id").asText();
            if (!responseId.isBlank()) {
                result.responseId = responseId;
            }
            if ("response.output_text.delta".equals(type)) {
                onDelta.accept(event.path("delta").asText());
            } else if ("response.output_item.done".equals(type)
                    && "function_call".equals(event.path("item").path("type").asText())) {
                JsonNode item = event.path("item");
                String callId = item.path("call_id").asText();
                if (callId.isBlank()) {
                    throw new OpenAiRequestException("OpenAI returned a tool call without a call id");
                }
                result.toolCalls.add(new ToolCall(callId, item.path("name").asText(), item.path("arguments").asText()));
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

    @FunctionalInterface
    public interface ToolCallHandler {
        String handle(ToolCall call);
    }

    public record ToolCall(String callId, String name, String arguments) {
    }

    private record ToolOutput(String callId, String output) {
    }

    private record StreamResult(String responseId, List<ToolCall> toolCalls) {
    }

    private static class StreamResultBuilder {
        private String responseId;
        private final List<ToolCall> toolCalls = new ArrayList<>();

        private StreamResult build() {
            return new StreamResult(responseId, List.copyOf(toolCalls));
        }
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
