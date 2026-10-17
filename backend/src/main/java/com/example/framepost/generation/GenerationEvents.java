package com.example.framepost.generation;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Pushes generation status changes to open browser streams. */
@Component
public class GenerationEvents {

    static final String EVENT_NAME = "update";
    private static final Duration STREAM_TIMEOUT = Duration.ofMinutes(30);

    private record Listener(SseEmitter emitter, Supplier<GenerationResponse> snapshot) {
    }

    private final Map<String, List<Listener>> listeners = new ConcurrentHashMap<>();

    /**
     * Opens a stream and sends the current state. The listener is registered before the state is read,
     * so no update can be missed in between; a finished generation closes the stream straight away.
     */
    public SseEmitter subscribe(String id, Supplier<GenerationResponse> snapshot) {
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT.toMillis());
        Listener listener = new Listener(emitter, snapshot);
        listeners.computeIfAbsent(id, key -> new CopyOnWriteArrayList<>()).add(listener);
        emitter.onCompletion(() -> remove(id, listener));
        emitter.onTimeout(() -> remove(id, listener));
        emitter.onError(error -> remove(id, listener));
        send(id, listener);
        return emitter;
    }

    /** Re-reads the generation for every open stream and sends it. */
    public void publish(String id) {
        List<Listener> open = listeners.get(id);
        if (open == null) {
            return;
        }
        open.forEach(listener -> send(id, listener));
    }

    private void send(String id, Listener listener) {
        try {
            GenerationResponse update = listener.snapshot().get();
            listener.emitter().send(SseEmitter.event().name(EVENT_NAME).data(update));
            if (update.status() != ContentGeneration.Status.PROCESSING) {
                listener.emitter().complete();
            }
        } catch (IOException | IllegalStateException exception) {
            remove(id, listener);
        } catch (RuntimeException exception) {
            // The generation was deleted or can no longer be read.
            remove(id, listener);
            listener.emitter().complete();
        }
    }

    private void remove(String id, Listener listener) {
        listeners.computeIfPresent(id, (key, open) -> {
            open.remove(listener);
            return open.isEmpty() ? null : open;
        });
    }
}
