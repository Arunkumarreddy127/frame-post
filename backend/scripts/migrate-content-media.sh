#!/bin/bash
# Migrate content generation schema from v1 (embedded media) to v2 (separate collections)
# Usage:
#   ./migrate-content-media.sh [--dry-run] [--verify-only]
#
# Options:
#   --dry-run       Perform migration without writing to database (audit)
#   --verify-only   Count existing v1 docs without performing migration

set -e
cd "$(dirname "$0")/.."

readonly MVN="${MVN:-./mvnw}"

if [[ ! -f "$MVN" ]]; then
    echo "Error: mvnw not found. Must run from backend/scripts/" >&2
    exit 1
fi

echo "Content Media Migration (schema v1 → v2)"
echo "  Extracts embedded inputs/outputs into separate collections"
echo "  indexes on (userId, createdAt) for both media collections"
echo ""

# Parse arguments
DRY_RUN=""
VERIFY_ONLY=""
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN="--dry-run" ;;
        --verify-only) VERIFY_ONLY="--verify-only" ;;
        *)
            echo "Unknown option: $arg" >&2
            echo "Usage: $0 [--dry-run] [--verify-only]" >&2
            exit 1
            ;;
    esac
done

if [[ -n "$DRY_RUN" ]] && [[ -n "$VERIFY_ONLY" ]]; then
    echo "Error: choose --dry-run or --verify-only, not both" >&2
    exit 1
fi

if [[ -n "$DRY_RUN" ]]; then
    echo "DRY RUN: showing what would be migrated (no database writes)"
    echo ""
    "$MVN" spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=migrate-content-media --dry-run" || true
elif [[ -n "$VERIFY_ONLY" ]]; then
    echo "VERIFY ONLY: counting existing schema versions"
    echo ""
    "$MVN" spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=migrate-content-media --verify-only" || true
else
    echo "WARNING: This will migrate your content_generations collection and create content_inputs/content_outputs"
    echo "Ensure you have a backup of your MongoDB database before proceeding."
    echo ""
    read -p "Continue? (yes/no): " -r response
    if [[ "$response" != "yes" ]]; then
        echo "Migration cancelled"
        exit 0
    fi
    echo ""
    "$MVN" spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=migrate-content-media" || true
fi

echo ""
echo "Migration complete. Check logs above for results."
