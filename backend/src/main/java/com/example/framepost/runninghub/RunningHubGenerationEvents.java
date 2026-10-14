package com.example.framepost.runninghub;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import com.example.framepost.runninghub.RunningHubGenerationService.GenerationResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Pushes generation status changes to open browser streams. */
@Component
public class RunningHubGenerationEvents {

    static final String EVENT_NAME = "update";
    private static final Duration STREAM_TIMEOUT = Duration.ofMinutes(30);

    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    /** Registers a stream before the current state is read, so no update can be missed in between. */
    public SseEmitter register(String id) {
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT.toMillis());
        emitters.computeIfAbsent(id, key -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(id, emitter));
        emitter.onTimeout(() -> remove(id, emitter));
        emitter.onError(error -> remove(id, emitter));
        return emitter;
    }

    /** Sends the current state; a finished generation closes the stream straight away. */
    public void sendSnapshot(SseEmitter emitter, String id, GenerationResponse current) {
        send(emitter, id, current);
    }

    public void publish(GenerationResponse update) {
        List<SseEmitter> listeners = emitters.get(update.id());
        if (listeners == null) {
            return;
        }
        for (SseEmitter emitter : listeners) {
            send(emitter, update.id(), update);
        }
    }

    private void send(SseEmitter emitter, String id, GenerationResponse update) {
        try {
            emitter.send(SseEmitter.event().name(EVENT_NAME).data(update));
            if (update.status() != RunningHubGenerationStatus.PROCESSING) {
                emitter.complete();
            }
        } catch (IOException | IllegalStateException exception) {
            remove(id, emitter);
        }
    }

    private void remove(String id, SseEmitter emitter) {
        emitters.computeIfPresent(id, (key, listeners) -> {
            listeners.remove(emitter);
            return listeners.isEmpty() ? null : listeners;
        });
    }
}
