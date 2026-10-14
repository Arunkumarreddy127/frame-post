package com.example.framepost.runninghub.transform;

import java.util.Map;
import java.util.Set;

/**
 * A named derivation that turns validated inputs into node values. Workflow definitions refer to
 * transforms by {@link #type()}, so new derivations are added here rather than per workflow.
 */
public interface InputTransform {

    String type();

    /** Role names this transform reads from its definition's {@code inputs} map. */
    Set<String> roles();

    /** Output names this transform produces; each may be targeted by a node field. */
    Set<String> outputs();

    /**
     * @param input validated values keyed by role (text) and files keyed by role (bytes)
     * @param params constants from the definition
     * @return output values keyed by output name
     * @throws IllegalArgumentException when the input is not acceptable
     */
    Map<String, String> apply(TransformInput input, Map<String, String> params);
}
