package com.example.framepost.runninghub;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import com.example.framepost.config.RunningHubProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

@Component
public class RunningHubClient {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RunningHubProperties properties;

    public RunningHubClient(RunningHubProperties properties) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        this.properties = properties;
    }

    /**
     * Uploads a file for a workflow input and returns the name RunningHub expects in node field values.
     *
     * @param fileType RunningHub file type, such as {@code image} or {@code video}
     */
    public String uploadFile(String fileType, byte[] bytes, String filename, String contentType) {
        String boundary = "framepost" + UUID.randomUUID();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        writeField(body, boundary, "apiKey", requireApiKey());
        writeField(body, boundary, "fileType", fileType);
        writePart(body, boundary, filename, contentType, bytes);
        writeAscii(body, "--" + boundary + "--\r\n");
        JsonNode data = post("/task/openapi/upload", "multipart/form-data; boundary=" + boundary, body.toByteArray());
        String fileName = data.path("fileName").asText("");
        if (fileName.isBlank()) {
            throw new RunningHubException("RunningHub did not return an uploaded file name");
        }
        return fileName;
    }

    public String createTask(String workflowId, List<NodeInfo> nodes, String webhookUrl) {
        if (workflowId == null || workflowId.isBlank()) {
            throw new RunningHubException("RunningHub workflow ID is not configured");
        }
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("apiKey", requireApiKey());
        payload.put("workflowId", workflowId);
        if (webhookUrl != null && !webhookUrl.isBlank()) {
            payload.put("webhookUrl", webhookUrl);
        }
        ArrayNode nodeInfoList = payload.putArray("nodeInfoList");
        for (NodeInfo node : nodes) {
            ObjectNode entry = nodeInfoList.addObject();
            entry.put("nodeId", node.nodeId());
            entry.put("fieldName", node.fieldName());
            entry.put("fieldValue", node.fieldValue());
        }
        JsonNode data = post("/task/openapi/create", "application/json", json(payload));
        String taskId = data.path("taskId").asText("");
        if (taskId.isBlank()) {
            throw new RunningHubException("RunningHub did not return a task ID");
        }
        return taskId;
    }

    public String taskStatus(String taskId) {
        return post("/task/openapi/status", "application/json", json(taskPayload(taskId))).asText("");
    }

    /**
     * Returns the URL of the first output whose extension is in {@code extensions}, falling back to
     * the first output of any type.
     */
    public String outputUrl(String taskId, List<String> extensions) {
        JsonNode outputs = post("/task/openapi/outputs", "application/json", json(taskPayload(taskId)));
        String fallback = null;
        for (JsonNode output : outputs) {
            String url = output.path("fileUrl").asText("");
            if (url.isBlank()) {
                continue;
            }
            String fileType = output.path("fileType").asText("");
            if (extensions.stream().anyMatch(extension -> extension.equalsIgnoreCase(fileType)
                    || url.toLowerCase().endsWith("." + extension.toLowerCase()))) {
                return url;
            }
            if (fallback == null) {
                fallback = url;
            }
        }
        if (fallback == null) {
            throw new RunningHubException("RunningHub task finished without an output");
        }
        return fallback;
    }

    public byte[] download(String url) {
        try {
            HttpResponse<byte[]> response = httpClient.send(
                    HttpRequest.newBuilder(URI.create(url)).timeout(timeout()).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() / 100 != 2) {
                throw new RunningHubException("Unable to download the generated output");
            }
            return response.body();
        } catch (IOException exception) {
            throw new RunningHubException("Unable to download the generated output");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new RunningHubException("Output download was interrupted");
        }
    }

    private JsonNode post(String path, String contentType, byte[] body) {
        try {
            HttpResponse<String> response = httpClient.send(
                    HttpRequest.newBuilder(URI.create(baseUrl() + path))
                            .timeout(timeout())
                            .header("Content-Type", contentType)
                            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                            .build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode root = objectMapper.readTree(response.body());
            if (response.statusCode() / 100 != 2 || root.path("code").asInt(-1) != 0) {
                String message = root.path("msg").asText("");
                throw new RunningHubException("RunningHub request failed" + (message.isBlank() ? "" : ": " + message));
            }
            return root.path("data");
        } catch (IOException exception) {
            throw new RunningHubException("Unable to reach RunningHub");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new RunningHubException("RunningHub request was interrupted");
        }
    }

    private ObjectNode taskPayload(String taskId) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("apiKey", requireApiKey());
        payload.put("taskId", taskId);
        return payload;
    }

    private byte[] json(ObjectNode payload) {
        try {
            return objectMapper.writeValueAsBytes(payload);
        } catch (IOException exception) {
            throw new RunningHubException("Unable to build the RunningHub request");
        }
    }

    private Duration timeout() {
        return Duration.ofSeconds(properties.requestTimeoutSeconds());
    }

    private String baseUrl() {
        return properties.baseUrl().replaceAll("/$", "");
    }

    private String requireApiKey() {
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new RunningHubException("RunningHub is not configured");
        }
        return properties.apiKey();
    }

    private static void writeField(ByteArrayOutputStream out, String boundary, String name, String value) {
        writeAscii(out, "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"
                + value + "\r\n");
    }

    private static void writePart(
            ByteArrayOutputStream out, String boundary, String filename, String contentType, byte[] bytes
    ) {
        writeAscii(out, "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n");
        out.writeBytes(bytes);
        writeAscii(out, "\r\n");
    }

    private static void writeAscii(ByteArrayOutputStream out, String value) {
        out.writeBytes(value.getBytes(StandardCharsets.UTF_8));
    }
}
