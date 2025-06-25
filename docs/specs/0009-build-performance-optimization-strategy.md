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

#### 1.3 Selective Page Generation

- **Change Detection**: Implement file timestamp or content hash comparison
- **Incremental Builds**: Only regenerate pages whose source content has changed
- **Dependency Tracking**: Track which pages depend on which source files

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
