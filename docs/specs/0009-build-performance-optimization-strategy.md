# Build Performance Optimization Strategy

## Overview

This specification outlines a comprehensive strategy to optimize build performance for the memo.d.foundation hybrid architecture, specifically targeting the static page generation bottleneck that currently consumes approximately 50% of Docker build time.

## Problem Statement

### Current State

- **Static Page Generation**: 3,228 pages being generated during Next.js build
- **Build Time Impact**: Static generation represents ~50% of total Docker build time
- **Timeout Issues**: Build process timing out after 2 minutes at 177/3,228 pages (~5.4% completion)
- **Architecture Complexity**: Multi-stage pipeline: Obsidian → Elixir → TypeScript → Next.js

### Performance Bottlenecks Identified

1. **CPU-Intensive Processing**: Each page undergoes MDX transformation with remark/rehype plugins
2. **I/O Overhead**: File system operations in Docker environment with git submodule access
3. **No Incremental Builds**: Full regeneration of all pages on every build
4. **Content Pipeline Inefficiency**: Multiple processing stages without intermediate caching

## Architecture Context

### Current Build Pipeline

```
Obsidian Vault (Git Submodule)
    ↓
Elixir Markdown Compiler (lib/obsidian-compiler/)
    ↓
TypeScript Content Generation Scripts
    ↓
Next.js Static Site Generation (3,228 pages)
    ↓
Docker Image Build
```

### Technology Stack

- **Frontend**: Next.js 15 with React 19
- **Content Processing**: Elixir application for markdown compilation
- **Content Generation**: TypeScript scripts for navigation, search, and metadata
- **Deployment**: Static site generation with export
- **Infrastructure**: Docker-based CI/CD

## Optimization Strategy

### Phase 1: Immediate Optimizations (1-2 weeks)

#### 1.1 Content Pre-processing Cache

- **Goal**: Eliminate redundant content processing during Next.js build
- **Implementation**:
  - Generate preprocessed content bundle (JSON) from Elixir → TypeScript pipeline
  - Cache this bundle and only regenerate when source content changes
  - Modify Next.js `getStaticProps` to consume cached data instead of processing raw markdown

#### 1.2 Docker Build Optimization

- **Multi-stage Caching**:

  ```dockerfile
  # Stage 1: Content processing (cached)
  FROM elixir AS content-processor
  COPY lib/obsidian-compiler ./
  RUN mix deps.get && mix export_markdown

  # Stage 2: TypeScript generation (cached)
  FROM node AS content-generator
  COPY scripts/ ./scripts/
  COPY --from=content-processor /processed-content ./
  RUN pnpm run generate-all

  # Stage 3: Next.js build (optimized)
  FROM node AS builder
  COPY --from=content-generator /generated-content ./public/content/
  RUN pnpm next-build
  ```

#### 1.3 Incremental Builds Research Findings

**Current State Analysis (Railway Docker Cache Investigation):**

The existing Docker cache mounts in `Dockerfile:130-132` are **ineffective for true incremental builds**:

```dockerfile
# Current configuration (limited effectiveness)
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-nextjs-cache,target=/code/.next/cache \
    --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-build-cache,target=/tmp/build-cache \
    make build-static
```

**Root Cause:**

1. **Next.js Static Export Mode**: `next.config.ts` uses `output: 'export'` which disables Incremental Static Regeneration (ISR)
2. **Full Regeneration**: Static export mode always regenerates all 3,228 pages regardless of content changes
3. **Limited Cache Benefit**: Current cache only helps with compilation (TypeScript, SWC, Webpack) providing 5-10% improvement
4. **Content Processing Pipeline**: No change detection - always processes entire 790MB vault submodule

**Proposed Solution: Content-Aware Caching Strategy**

**Smart Build Script Implementation:**

```bash
#!/bin/bash
# scripts/smart-build.sh
set -e

VAULT_HASH=$(cd vault && git rev-parse HEAD)
CACHE_DIR="/tmp/build-cache"
VAULT_CACHE="$CACHE_DIR/vault-$VAULT_HASH"

echo "Vault hash: $VAULT_HASH"

# Skip Elixir processing if vault unchanged
if [ -d "$VAULT_CACHE" ]; then
    echo "✓ Using cached Elixir output"
    cp -r "$VAULT_CACHE"/* public/content/
else
    echo "→ Processing vault with Elixir"
    cd lib/obsidian-compiler && mix export_markdown
    mkdir -p "$VAULT_CACHE"
    cp -r public/content/* "$VAULT_CACHE/"
fi

# TypeScript generation with content change detection
CONTENT_HASH=$(find public/content -name "*.json" -exec md5sum {} \; | md5sum | cut -d' ' -f1)
TS_CACHE="$CACHE_DIR/ts-$CONTENT_HASH"

if [ -d "$TS_CACHE" ]; then
    echo "✓ Using cached TypeScript generation"
    cp -r "$TS_CACHE"/* public/content/
else
    echo "→ Running TypeScript generation"
    pnpm run generate-menu
    pnpm run generate-search-index
    # ... other generation scripts
    mkdir -p "$TS_CACHE"
    cp -r public/content/* "$TS_CACHE/"
fi

# Next.js build (still full, but with optimized inputs)
echo "→ Building Next.js"
pnpm run next-build
```

**Enhanced Dockerfile Configuration:**

```dockerfile
# Replace lines 130-132 with enhanced cache strategy
RUN --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-smart-cache,target=/tmp/build-cache \
    --mount=type=cache,id=s/b794785d-77e3-4281-a780-3c9c7f3e77cf-${RAILWAY_ENVIRONMENT_NAME}-nextjs-cache,target=/code/.next/cache \
    chmod +x scripts/smart-build.sh && \
    scripts/smart-build.sh
```

**Expected Performance Improvements:**

- **Unchanged Content Builds**: 70-80% time reduction (cache hits)
- **Partial Content Changes**: 40-60% time reduction (selective processing)
- **Cold Builds**: 20-30% time reduction (optimized pipeline)

**Alternative: ISR Migration Consideration**
For true incremental page generation:

- Remove `output: 'export'` from `next.config.ts`
- Deploy as Node.js app on Railway instead of static nginx
- Enable Next.js ISR with persistent storage for cache
- Maintain CDN benefits with edge caching

**Implementation Priority:**

1. **Phase 1**: Implement content-aware caching (maintains current deployment model)
2. **Phase 2**: Evaluate ISR migration for long-term scalability

### Phase 2: Architectural Improvements (2-4 weeks)

#### 2.1 Content Bundle Architecture

- **Static Content API**: Generate a comprehensive content API during build-time
- **Page Template Optimization**: Simplify `getStaticProps` to basic data fetching
- **Parallel Processing**: Leverage Next.js parallel static generation more effectively

#### 2.2 Build Pipeline Restructuring

```yaml
New Pipeline:
  Pre-build:
    - Elixir markdown processing (cached by content hash)
    - TypeScript content generation (cached by dependencies)
    - Content bundle creation (single comprehensive JSON/database)

  Build:
    - Next.js focuses purely on page rendering
    - Minimal `getStaticProps` complexity
    - Optimized MDX processing
```

#### 2.3 Performance Monitoring

- **Build Analytics**: Implement detailed timing metrics for each build phase
- **Performance Regression Detection**: Automated alerts for build time increases
- **Resource Utilization**: Monitor CPU/memory/I-O during different build phases

### Phase 3: Advanced Optimizations (4-8 weeks)

#### 3.1 Hybrid Rendering Strategy

- **Evaluate ISR**: Consider Incremental Static Regeneration for frequently changing content
- **Static vs Dynamic**: Identify which pages truly need static generation vs server-side rendering
- **Edge Deployment**: Explore edge-based content delivery optimizations

#### 3.2 Content Processing Evolution

- **DuckDB Integration**: Leverage existing DuckDB setup for more efficient content queries
- **Content Indexing**: Pre-index content for faster search and navigation generation
- **Asset Optimization**: Optimize images and other assets during content processing phase

#### 3.3 Development Experience

- **Local Development**: Optimize local development build times with subset generation
- **Preview Builds**: Fast preview builds for development with content sampling
- **Hot Reloading**: Improve development experience with targeted rebuilds

## Success Metrics

### Performance Targets

- **Build Time Reduction**: 50% reduction in total build time (from ~37 minutes projected to ~18 minutes)
- **Static Generation**: Reduce from 50% to <20% of total build time
- **Cache Hit Rate**: >80% cache hits for unchanged content
- **Parallel Efficiency**: Utilize available CPU cores effectively

### Quality Metrics

- **Build Reliability**: Eliminate timeout issues
- **Content Accuracy**: Maintain 100% content fidelity
- **Development Velocity**: Faster iteration cycles for content changes
- **Resource Efficiency**: Optimize Docker layer caching and build context

## Implementation Roadmap

### Week 1-2: Phase 1 Implementation

- [ ] Implement content preprocessing cache
- [ ] Optimize Docker build stages
- [ ] Deploy selective page generation
- [ ] Measure performance improvements

### Week 3-4: Phase 1 Refinement

- [ ] Fine-tune caching strategies
- [ ] Optimize parallel processing
- [ ] Implement monitoring
- [ ] Performance regression testing

### Week 5-8: Phase 2 Implementation

- [ ] Restructure content pipeline
- [ ] Implement content bundle architecture
- [ ] Deploy advanced caching
- [ ] Comprehensive performance testing

### Week 9-16: Phase 3 Evaluation

- [ ] Evaluate hybrid rendering strategies
- [ ] Advanced content processing optimizations
- [ ] Long-term architecture improvements
- [ ] Performance optimization maintenance

## Risk Assessment

### Technical Risks

- **Content Fidelity**: Risk of content processing changes affecting output
- **Cache Invalidation**: Complex dependency tracking for cache invalidation
- **Build Complexity**: Increased complexity in build pipeline management

### Mitigation Strategies

- **Comprehensive Testing**: Automated content validation and comparison
- **Rollback Strategy**: Ability to revert to current build process
- **Monitoring**: Real-time build performance and success rate monitoring
- **Documentation**: Comprehensive documentation of all optimizations

## Dependencies

- Docker build environment optimization
- Next.js configuration updates
- Elixir compiler modifications
- TypeScript script refactoring
- CI/CD pipeline updates

## Related Work

- ADR 0011: Remove Debug Logging from Production Builds (completed)
- Existing Docker UTF-8 optimizations
- Current Elixir markdown processing pipeline

## Implementation Todo List

### Priority 1: Immediate Incremental Build Implementation (1-2 weeks)

#### High Priority Tasks

- [ ] **Create Smart Build Script** (`scripts/smart-build.sh`)

  - Implement vault hash-based caching logic
  - Add content change detection for TypeScript generation
  - Include cache hit/miss logging for monitoring
  - Add fallback to current build process on cache failures

- [ ] **Update Dockerfile Configuration**

  - Replace lines 130-132 with enhanced cache mount strategy
  - Add smart-cache mount point for content-aware caching
  - Ensure proper permissions for script execution
  - Test cache mount effectiveness in Railway environment

- [ ] **Add Makefile Target**
  - Create `build-incremental` target that calls smart build script
  - Update existing `build-static` to optionally use incremental approach
  - Add build timing instrumentation for performance measurement

#### Medium Priority Tasks

- [ ] **Local Cache Performance Testing**

  - Test content-aware caching with simulated cache scenarios
  - Measure actual cache hit rates and performance improvements
  - Validate cache invalidation works correctly
  - Test edge cases (corrupted cache, partial cache, etc.)

- [ ] **Railway Staging Deployment**

  - Deploy enhanced caching to Railway staging environment
  - Monitor Railway cache storage usage and costs
  - Test cache persistence across deployments
  - Validate build performance improvements in cloud environment

- [ ] **Build Metrics Implementation**
  - Add detailed timing for each build phase (Elixir, TypeScript, Next.js)
  - Implement cache hit rate tracking and reporting
  - Create build performance dashboard/logging
  - Set up alerts for cache effectiveness regression

### Priority 2: Advanced Optimizations (3-4 weeks)

#### Medium Priority Tasks

- [ ] **Selective Page Generation**

  - Implement content-to-page dependency tracking
  - Create page invalidation logic based on content changes
  - Test selective regeneration with complex content relationships

- [ ] **Enhanced Content Processing**

  - Optimize Elixir markdown processing for incremental updates
  - Implement smarter TypeScript generation scripts
  - Add content fingerprinting for fine-grained cache invalidation

- [ ] **Performance Monitoring Integration**
  - Integrate with Railway monitoring/alerting systems
  - Create performance regression detection
  - Implement automated rollback on performance degradation

### Priority 3: Long-term Architecture Evaluation (2-3 months)

#### Low Priority Tasks

- [ ] **ISR Migration Evaluation**

  - Research Next.js ISR compatibility with current architecture
  - Evaluate Railway Node.js deployment vs static hosting
  - Create ISR proof-of-concept with subset of pages
  - Assess costs and benefits of deployment model change

- [ ] **Content Bundle Architecture**

  - Design pre-computed content API strategy
  - Implement content bundling for faster page generation
  - Evaluate DuckDB integration for content queries

- [ ] **Advanced Caching Strategies**
  - Implement multi-tier caching (memory + disk + remote)
  - Add intelligent cache warming for new deployments
  - Design cache sharing across Railway environments

### Validation & Testing Checklist

#### Functional Testing

- [ ] Verify content accuracy after cache implementation
- [ ] Test all content generation scripts work with caching
- [ ] Validate no regressions in deployed site functionality
- [ ] Test cache behavior across different content change scenarios

#### Performance Testing

- [ ] Measure build time improvements for various change scenarios
- [ ] Validate cache hit rates meet >60% target for typical workflows
- [ ] Test build reliability under cache failures
- [ ] Monitor Railway resource usage and costs

#### Deployment Testing

- [ ] Test cache persistence across Railway deployments
- [ ] Validate cache isolation between environments
- [ ] Test rollback procedures if caching causes issues
- [ ] Verify monitoring and alerting work correctly

### Success Criteria Validation

#### Performance Metrics

- [ ] **Unchanged Content Builds**: Achieve 70-80% time reduction
- [ ] **Partial Content Changes**: Achieve 40-60% time reduction
- [ ] **Cold Builds**: Achieve 20-30% time reduction
- [ ] **Cache Hit Rate**: Maintain >60% for typical development workflows

#### Quality Metrics

- [ ] **Zero Functional Regressions**: All site features work correctly
- [ ] **Build Reliability**: Eliminate timeout issues and build failures
- [ ] **Developer Experience**: Faster iteration cycles for content changes
- [ ] **Operational Excellence**: Effective monitoring and alerting

### Risk Mitigation Checklist

#### Technical Risks

- [ ] **Cache Invalidation Edge Cases**: Test and handle corrupted/partial caches
- [ ] **Build Complexity**: Maintain rollback capability to current build process
- [ ] **Content Fidelity**: Automated validation of cached vs fresh content
- [ ] **Storage Costs**: Monitor and optimize Railway cache usage

#### Operational Risks

- [ ] **Deployment Safety**: Gradual rollout with staging validation
- [ ] **Monitoring Coverage**: Comprehensive logging and alerting setup
- [ ] **Documentation**: Complete operational runbooks for cache management
- [ ] **Team Knowledge**: Training on new build process and troubleshooting
