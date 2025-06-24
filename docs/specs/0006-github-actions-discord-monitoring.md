# GitHub Actions Discord Monitoring Implementation

## Overview

This specification documents the comprehensive Discord monitoring system implemented for all GitHub Actions workflows in the memo.d.foundation project. The system provides real-time notifications for build failures, deployment issues, and operational problems.

## Implemented Monitoring

### 1. **Database Backup Monitoring** (`.github/workflows/backup.yml`)

**Triggers:**

- Daily at 2 AM UTC via cron schedule
- Manual workflow dispatch

**Monitored Events:**

- ✅ **Success**: Daily database backup to S3 completed successfully
- ❌ **Failure**: Database backup process failed (DuckDB export, S3 upload, or general workflow failure)

**Notification Details:**

- Success: Green embed with confirmation message
- Failure: Red embed with error details and link to workflow logs

### 2. **Submodule Update Monitoring** (`.github/workflows/dispatch.yml`)

**Triggers:**

- Manual workflow dispatch
- Submodule content changes

**Monitored Events:**

- ✅ **Success**: All submodules updated and reindexed successfully
- ❌ **Failure**: Submodule update, AI summary generation, or commit/push failures

**Key Components Monitored:**

- Git submodule synchronization (Level 1 and Level 2 submodules)
- AI-generated summary creation
- Database export process
- Repository commit and push operations

### 3. **Redirect Generation Monitoring** (`.github/workflows/generate-redirects.yml`)

**Triggers:**

- Push to main branch with `db/vault.parquet` changes
- Manual workflow dispatch

**Monitored Events:**

- ✅ **Success**: Redirect mappings generated and committed (only when files are processed)
- ❌ **Failure**: DuckDB query failures, redirect script failures, or git operations

**Advanced Features:**

- Only sends success notifications when files are actually processed
- Monitors complex file change detection logic
- Tracks SQL query execution for redirect generation

### 4. **Arweave Deployment Monitoring** (`.github/workflows/deploy-arweave.yml`)

**Triggers:**

- Push to main branch with `db/vault.parquet` changes
- Manual workflow dispatch

**Monitored Events:**

- ✅ **Success**: Markdown files deployed to Arweave permanent storage (only when files are processed)
- ❌ **Failure**: Arweave deployment script failures, wallet issues, or git operations

**Key Components:**

- Arweave wallet authentication
- Permanent storage deployment
- Database updates with storage IDs

### 5. **NFT Minting Monitoring** (`.github/workflows/add-mint-post.yml`)

**Triggers:**

- Push to main branch with `db/vault.parquet` changes
- Manual workflow dispatch

**Monitored Events:**

- ❌ **Failure**: NFT minting contract failures, wallet decryption issues, or transaction failures

**Notes:**

- Success notifications are handled by the existing `notify-discord-minted-articles.ts` script
- Only failure notifications are added to avoid duplication

### 6. **Build Pipeline Monitoring** (`.github/workflows/build-monitor.yml`)

**Triggers:**

- Push to main branch
- Pull requests to main branch
- Manual workflow dispatch

**Comprehensive Monitoring:**

#### Build Process Testing

- Elixir compilation and dependency resolution
- Markdown export process (10-minute timeout)
- DuckDB export process (10-minute timeout)
- Next.js build process (30-minute timeout)
- Static file generation verification

#### Dependency Health Checks

- Node.js dependency vulnerability scanning
- Package.json and lock file synchronization
- Elixir dependency integrity checks

#### External Service Health Checks

- OpenAI API accessibility and authentication
- Jina API connectivity and authentication
- GitHub API rate limit monitoring

**Notification Types:**

- ✅ **Build Success**: All build components working correctly
- ❌ **Build Failure**: Critical build process failures
- ⚠️ **Service Issues**: External service accessibility problems

### 7. **Deployment Status Monitoring** (`.github/workflows/main.yml`)

**Triggers:**

- Push to main branch

**Enhanced Monitoring:**

- 15-minute wait for deployment completion
- Live site accessibility verification
- HTTP response code checking

**Monitored Events:**

- ✅ **Success**: Site accessible and returning HTTP 200
- ❌ **Failure**: Site not accessible or returning error codes
- ❌ **Check Failure**: Deployment verification process failed

## Technical Implementation

### Discord Integration

**Action Used:** `sarisia/actions-status-discord@v1`

**Standard Configuration:**

```yaml
- name: Notify Discord on Failure
  if: failure()
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK_URL }}
    title: '❌ [Workflow Name] Failed'
    description: 'Detailed failure description'
    color: 0xff0000
```

### Color Coding System

- 🟢 **Success**: `0x00ff00` (Green)
- 🔴 **Failure**: `0xff0000` (Red)
- 🟡 **Warning**: `0xffa500` (Orange)

### Conditional Notifications

**Success Notifications:**

- Only sent when workflows complete successfully
- Some workflows only notify on success when files are actually processed

**Failure Notifications:**

- Sent on any workflow failure
- Include contextual information about the failure type

**Warning Notifications:**

- Sent for service degradation or potential issues
- Used for external service connectivity problems

## Required Secrets

The following GitHub secrets must be configured:

### Discord Integration

- `DISCORD_WEBHOOK`: Discord webhook URL for notifications

### API Keys (for build monitoring)

- `OPENAI_API_KEY`: OpenAI API authentication
- `JINA_API_KEY`: Jina API authentication
- `JINA_BASE_URL`: Jina API base URL

### Repository Access

- `DWARVES_PAT`: GitHub Personal Access Token for repository operations

### Deployment Keys

- `VAULT_ADDR`, `VAULT_ROLE_ID`, `VAULT_SECRET_ID`: HashiCorp Vault authentication
- `ARWEAVE_WALLET_JSON`: Arweave wallet for permanent storage
- `ENCRYPTED_WALLET_PRIVATE_KEY`: Encrypted wallet for NFT minting

## Notification Examples

### Success Notification

```
✅ Database Backup Completed
Daily database backup to S3 completed successfully

Workflow: Database Backup
Repository: dwarvesf/memo.d.foundation
Branch: main
Triggered by: github-actions[bot]
```

### Failure Notification

```
❌ Build Pipeline Test Failed
Build process failed during testing. Main deployment may be affected.

Workflow: Build Pipeline Monitor
Repository: dwarvesf/memo.d.foundation
Branch: main
Commit: abc123def
Triggered by: user
```

### Warning Notification

```
⚠️ External Service Issues Detected
Some external services may be experiencing issues. This could affect builds.

Workflow: Build Pipeline Monitor
Repository: dwarvesf/memo.d.foundation
```

## Monitoring Coverage

### Covered Scenarios

1. ✅ **Database Operations**: Backup failures, export failures
2. ✅ **Content Processing**: Markdown processing, DuckDB operations
3. ✅ **Deployment Pipeline**: Build failures, static generation issues
4. ✅ **External Integrations**: API failures, service degradation
5. ✅ **Repository Operations**: Submodule updates, commit/push failures
6. ✅ **Blockchain Operations**: NFT minting failures, Arweave deployment issues

### Alert Frequency

- **Immediate**: Critical failures (build, deployment, backup)
- **Daily**: Scheduled backup operations
- **On-demand**: Manual workflow triggers
- **Conditional**: Only when processing files (redirects, Arweave, minting)

## Maintenance and Updates

### Adding New Monitoring

1. Add the `sarisia/actions-status-discord@v1` action to the workflow
2. Configure appropriate conditions (`if: failure()`, `if: success()`)
3. Set descriptive titles and messages
4. Use appropriate color coding
5. Test with manual workflow dispatch

### Monitoring the Monitoring

- Discord webhook failures are logged but don't fail the workflow
- Notification failures include fallback error messages
- All notifications include direct links to workflow runs

## Benefits

1. **Immediate Awareness**: Real-time notifications of system issues
2. **Contextual Information**: Rich embeds with workflow details and links
3. **Proactive Monitoring**: Catch issues before they affect users
4. **Comprehensive Coverage**: All critical workflows monitored
5. **Actionable Alerts**: Direct links to logs and failure details
6. **Service Health**: External dependency monitoring prevents surprises

This monitoring system ensures that any issues with the memo.d.foundation infrastructure are immediately communicated to the team via Discord, enabling rapid response and resolution.
