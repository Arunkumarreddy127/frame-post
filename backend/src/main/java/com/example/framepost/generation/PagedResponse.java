package com.example.framepost.generation;

import java.util.List;

/** One page of a newest-first listing; {@code nextCursor} is null when nothing is left. */
public record PagedResponse<T>(List<T> items, String nextCursor) {
}
