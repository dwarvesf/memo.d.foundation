---
title: 'Project Runbook'
last_updated: '2025-06-25T16:57:31.037Z'
distilled_from:
  - 'docs/adr/0011-remove-debug-logging-production-builds.md'
  - 'docs/changelog/0006-reduced-build-log-verbosity.md'
  - 'docs/specs/0009-build-performance-optimization-strategy.md'
  - 'src/pages/contributor/index.tsx'
---

# Project Runbook: memo.d.foundation Build Performance

## Build Performance Investigation and Optimization

### Issue Resolution: Verbose Build Logging

**Problem**: The `pnpm next-build` command was producing extremely verbose output, contributing to CI/CD performance issues and making build monitoring difficult.

**Root Cause**: A debug `console.log` statement in `src/pages/contributor/index.tsx:134-138` was outputting massive contributor datasets during Next.js static site generation, including thousands of lines of JSON with contributor profiles, GitHub information, and contribution statistics.

**Resolution**: Removed the verbose debug logging by commenting out the problematic statement. This immediately eliminated thousands of lines of build output without affecting functionality.

**Impact**: Cleaner build logs, improved CI/CD monitoring, and reduced I/O overhead during builds.

### Current Build Performance Architecture

**Build Pipeline Overview**:

```
Obsidian Vault (Git Submodule) →
Elixir Compiler (lib/obsidian-compiler/) →
TypeScript Generation Scripts →
Next.js Static Generation (3,228 pages) →
Docker Image Build
```

**Performance Bottleneck**: Static page generation represents approximately 50% of total Docker build time, with the process timing out after generating only 177 of 3,228 pages (~5.4% completion in 2 minutes).

**Key Performance Issues Identified**:

1. **CPU-Intensive Processing**: Each page undergoes MDX transformation with remark/rehype plugins
2. **I/O Overhead**: File system operations in Docker with git submodule access
3. **No Incremental Builds**: Full regeneration of all pages on every build
4. **Content Pipeline Inefficiency**: Multiple processing stages without intermediate caching

### Build Performance Optimization Strategy

**Phase 1: Immediate Optimizations (1-2 weeks)**

- Content pre-processing cache to eliminate redundant processing
- Multi-stage Docker build optimization with proper caching
- Selective page generation based on content changes

**Phase 2: Architectural Improvements (2-4 weeks)**

- Content bundle architecture for simplified page generation
- Build pipeline restructuring with cached intermediate results
- Performance monitoring and regression detection

**Phase 3: Advanced Optimizations (4-8 weeks)**

- Hybrid rendering strategy evaluation (ISR consideration)
- Content processing evolution with DuckDB integration
- Development experience optimization

**Target Metrics**:

- 50% reduction in total build time (from ~37 minutes projected to ~18 minutes)
- Reduce static generation from 50% to <20% of total build time
- > 80% cache hit rate for unchanged content
- Eliminate build timeout issues

### Technology Stack Context

**Frontend**: Next.js 15 with React 19, static site generation with export
**Content Processing**: Elixir application for robust markdown compilation
**Content Generation**: TypeScript scripts for navigation, search indices, and metadata
**Infrastructure**: Docker-based CI/CD with multi-stage builds
**Content Source**: Git submodule containing Obsidian vault with 3,228+ markdown files

### Operational Procedures

**Build Monitoring**:

- Monitor build completion rates and timing
- Track static page generation progress
- Alert on build timeouts or performance regressions

**Debug Logging Standards**:

- Use conditional logging based on environment variables
- Avoid verbose data dumps in production build paths
- Implement structured logging with appropriate levels
- Regular audits for console.log statements in production code

**Performance Assessment**:

- Measure build time by phase (content processing, static generation, Docker build)
- Track log verbosity and storage requirements
- Monitor cache hit rates and invalidation patterns
- Assess resource utilization during different build phases

### Key Files and Components

**Build Configuration**:

- `next.config.ts`: Next.js configuration with MDX processing
- `package.json`: Build scripts and dependency management
- `Dockerfile`: Multi-stage build configuration
- `Makefile`: Development and build orchestration

**Content Processing**:

- `lib/obsidian-compiler/`: Elixir application for markdown processing
- `scripts/`: TypeScript content generation scripts
- `vault/`: Git submodule containing source markdown content

**Static Generation**:

- `src/pages/contributor/index.tsx`: Contributor page with optimization history
- `src/pages/[...slug].tsx`: Dynamic page generation
- `public/content/`: Generated content bundles and indices

### Future Optimization Opportunities

**Content Architecture**:

- Implement content bundle caching strategy
- Optimize MDX transformation pipeline
- Leverage DuckDB for efficient content queries

**Build Infrastructure**:

- Advanced Docker layer caching
- Parallel processing optimization
- Resource allocation tuning

**Development Experience**:

- Faster local development builds
- Subset generation for testing
- Hot reloading improvements

### Related Documentation

- **ADR 0011**: Remove Debug Logging from Production Builds - Documents the decision to eliminate verbose logging
- **Changelog 0006**: Reduced Build Log Verbosity - User-facing improvements from logging optimization
- **Spec 0009**: Build Performance Optimization Strategy - Comprehensive optimization roadmap
- **Runbook PR #21**: Diagnostic patterns for debug logging performance issues
