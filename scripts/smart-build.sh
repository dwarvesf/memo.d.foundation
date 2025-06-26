#!/bin/bash
# scripts/smart-build.sh
# Content-aware build script with intelligent caching for memo.d.foundation
# Implements vault hash-based caching to reduce build times for unchanged content
set -e

VAULT_HASH=$(cd vault && git rev-parse HEAD)
CACHE_DIR="/tmp/build-cache"
VAULT_CACHE="$CACHE_DIR/vault-$VAULT_HASH"

echo "🔍 Vault hash: $VAULT_HASH"
echo "📁 Cache directory: $CACHE_DIR"

# Create cache directory if it doesn't exist
mkdir -p "$CACHE_DIR"

# Stage 1: Skip Elixir processing if vault unchanged
if [ -d "$VAULT_CACHE" ]; then
    echo "✅ Using cached Elixir output (vault unchanged)"
    # Ensure public/content directory exists
    mkdir -p public/content
    cp -r "$VAULT_CACHE"/* public/content/
    echo "📋 Restored cached content from: $VAULT_CACHE"
    
    # Also need to ensure db/ directory exists (DuckDB output)
    DB_CACHE="$CACHE_DIR/db-$VAULT_HASH"
    if [ -d "$DB_CACHE" ]; then
        echo "✅ Using cached DuckDB output"
        cp -r "$DB_CACHE"/* ./
    else
        echo "🔄 Running DuckDB export (db cache missing)"
        cd lib/obsidian-compiler && mix duckdb.export
        cd ../..
        # Cache the db output
        mkdir -p "$DB_CACHE"
        cp -r db/ "$DB_CACHE/"
    fi
else
    echo "🔄 Processing vault with Elixir (content changed)"
    echo "⏱️  Starting Elixir markdown compilation..."

    # Run Elixir markdown processing
    cd lib/obsidian-compiler && mix export_markdown
    
    # Export to DuckDB (creates db/ directory)
    echo "⏱️  Exporting to DuckDB..."
    mix duckdb.export
    cd ../..

    # Cache the processed output
    mkdir -p "$VAULT_CACHE"
    if [ -d "public/content" ]; then
        cp -r public/content/* "$VAULT_CACHE/"
        echo "💾 Cached Elixir output to: $VAULT_CACHE"
    else
        echo "⚠️  Warning: public/content directory not found after Elixir processing"
    fi
    
    # Cache the DuckDB output
    DB_CACHE="$CACHE_DIR/db-$VAULT_HASH"
    mkdir -p "$DB_CACHE"
    if [ -d "db" ]; then
        cp -r db/ "$DB_CACHE/"
        echo "💾 Cached DuckDB output to: $DB_CACHE"
    else
        echo "⚠️  Warning: db/ directory not found after DuckDB export"
    fi
fi

# Stage 2: TypeScript generation with content change detection
echo "🔍 Checking TypeScript generation cache..."

# Generate content hash from all JSON files in public/content
CONTENT_HASH=""
if [ -d "public/content" ]; then
    CONTENT_HASH=$(find public/content -name "*.json" -type f -exec md5sum {} \; 2>/dev/null | md5sum | cut -d' ' -f1)
fi

# Fallback to vault hash if no content found
if [ -z "$CONTENT_HASH" ]; then
    CONTENT_HASH="$VAULT_HASH"
    echo "📝 Using vault hash as content hash (no JSON files found)"
else
    echo "🔢 Content hash: $CONTENT_HASH"
fi

TS_CACHE="$CACHE_DIR/ts-$CONTENT_HASH"

if [ -d "$TS_CACHE" ] && [ "$(ls -A "$TS_CACHE" 2>/dev/null)" ]; then
    echo "✅ Using cached TypeScript generation (content unchanged)"
    cp -r "$TS_CACHE"/* public/content/
    echo "📋 Restored cached TypeScript output from: $TS_CACHE"
else
    echo "🔄 Running TypeScript generation scripts (content changed)"
    echo "⏱️  Generating navigation menu..."
    pnpm run generate-menu

    echo "⏱️  Generating menu path sorted..."
    pnpm run generate-menu-path-sorted

    echo "⏱️  Generating backlinks..."
    pnpm run generate-backlinks

    echo "⏱️  Generating search index..."
    pnpm run generate-search-index

    echo "⏱️  Generating redirects map..."
    pnpm run generate-redirects-map

    echo "⏱️  Generating shorten map..."
    pnpm run generate-shorten-map

    echo "⏱️  Generating pageviews..."
    pnpm run generate-pageviews

    echo "⏱️  Fetching prompts..."
    pnpm run fetch-prompts

    echo "⏱️  Fetching contributors..."
    pnpm run fetch-contributors

    # Cache the TypeScript generation output
    mkdir -p "$TS_CACHE"
    if [ -d "public/content" ]; then
        cp -r public/content/* "$TS_CACHE/"
        echo "💾 Cached TypeScript output to: $TS_CACHE"
    else
        echo "⚠️  Warning: public/content directory not found after TypeScript generation"
    fi
fi

# Stage 3: Next.js build (still full, but with optimized inputs)
echo "🏗️  Building Next.js application..."
echo "⏱️  Starting Next.js static generation (3,228 pages)..."

# Use the existing next-build command
pnpm run next-build

# Generate nginx configuration (required for Docker build)
echo "Running post-build..."
pnpm run post-build

echo "✅ Smart build completed successfully!"

# Cache cleanup: Keep only the 5 most recent caches to prevent disk bloat
echo "🧹 Cleaning up old cache entries..."
if [ -d "$CACHE_DIR" ]; then
    # Remove vault caches older than 5 most recent
    ls -1t "$CACHE_DIR"/vault-* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

    # Remove TypeScript caches older than 5 most recent
    ls -1t "$CACHE_DIR"/ts-* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

    REMAINING_CACHES=$(ls -1 "$CACHE_DIR" 2>/dev/null | wc -l)
    echo "📊 Cache entries remaining: $REMAINING_CACHES"
fi

echo "🎯 Build performance summary:"
echo "   - Vault processing: $([ -d "$VAULT_CACHE" ] && echo "CACHED ✅" || echo "REBUILT 🔄")"
echo "   - TypeScript generation: $([ -d "$TS_CACHE" ] && echo "CACHED ✅" || echo "REBUILT 🔄")"
echo "   - Next.js build: ALWAYS REBUILT 🔄 (static export mode)"
