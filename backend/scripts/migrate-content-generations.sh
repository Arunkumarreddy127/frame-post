#!/usr/bin/env bash
set -euo pipefail

backend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
mode="${1:-}"
if [[ $# -gt 1 ]] || [[ -n "$mode" && "$mode" != "--dry-run" && "$mode" != "--verify-only" ]]; then
    printf 'Usage: %s [--dry-run|--verify-only]\n' "$0" >&2
    exit 2
fi
if [[ -z "${MONGODB_URI:-}" || -z "${MONGODB_DATABASE:-}" ]]; then
    printf 'Export MONGODB_URI and MONGODB_DATABASE explicitly before running this migration.\n' >&2
    exit 2
fi
if ! command -v java >/dev/null 2>&1; then
    printf 'Java 21 or later is required.\n' >&2
    exit 2
fi
jar="$backend_dir/target/framepost-backend-0.0.1-SNAPSHOT.jar"
if [[ ! -f "$jar" ]]; then
    printf 'Build the backend first: cd %s && ./mvnw package\n' "$backend_dir" >&2
    exit 2
fi
arguments=(--spring.profiles.active=migrate-content-generations)
if [[ -n "$mode" ]]; then
    arguments+=("$mode")
fi
exec java -jar "$jar" "${arguments[@]}"