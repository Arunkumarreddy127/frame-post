package com.example.framepost.runninghub.transform;

import java.util.Map;

/**
 * Values for one transform call, keyed by the role names the transform declares.
 *
 * @param values text values (already defaulted and validated)
 * @param files  file contents for file inputs
 */
public record TransformInput(Map<String, String> values, Map<String, byte[]> files) {
}
