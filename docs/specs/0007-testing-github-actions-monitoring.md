# Testing GitHub Actions Monitoring Implementation

## Overview

This document provides a comprehensive testing strategy for the newly implemented Discord monitoring and refactored GitHub Actions workflows. Testing should be done in a controlled manner to avoid disrupting production operations.

## Pre-Testing Checklist

### 1. **Verify Discord Webhook Secret**

```bash
# Check if DISCORD_WEBHOOK secret is configured
# Go to: Repository Settings > Secrets and variables > Actions
# Ensure DISCORD_WEBHOOK is set with your Discord webhook URL
```

### 2. **Test Discord Webhook Manually**

```bash
# Test the webhook directly to ensure it works
curl -H "Content-Type: application/json" \
     -d '{"content":"🧪 Testing webhook from memo.d.foundation"}' \
     "YOUR_DISCORD_WEBHOOK_URL"
```

### 3. **Backup Current State**

```bash
# Create a backup branch before testing
git checkout -b testing-monitoring-$(date +%Y%m%d)
git push origin testing-monitoring-$(date +%Y%m%d)
```

## Testing Strategy

### Phase 1: Test Reusable Git Action (Low Risk)

#### 1.1 **Test the Git Commit-Push Action**

Create a minimal test to verify the reusable action works:

```yaml
# Create: .github/workflows/test-git-action.yml
name: Test Git Action
on:
  workflow_dispatch:
    inputs:
      test_message:
        description: 'Test commit message'
        required: true
        default: 'test: verify git action works'

jobs:
  test-git-action:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.DWARVES_PAT }}
          submodules: recursive

      - name: Make a small change
        run: |
          echo "# Test file created at $(date)" > test-file-$(date +%s).md

      - name: Test git action
        uses: ./.github/actions/git-commit-push
        with:
          commit-message: ${{ github.event.inputs.test_message }}

      - name: Cleanup test file
        run: |
          rm -f test-file-*.md
          git add -A
          git commit -m "cleanup: remove test files" || echo "No test files to remove"
          git push || echo "Nothing to push"
```

**How to test:**

1. Go to Actions tab in GitHub
2. Select "Test Git Action" workflow
3. Click "Run workflow"
4. Enter a test message
5. Monitor the run to ensure it completes successfully

### Phase 2: Test Discord Notifications (Medium Risk)

#### 2.1 **Test Individual Workflow Discord Notifications**

**A. Test Backup Workflow Notifications:**

```bash
# Trigger manually to test notifications
# Go to Actions > Backup > Run workflow
# This will test both success and failure scenarios
```

**B. Test Dispatch Workflow Notifications:**

```bash
# Go to Actions > Update submodules > Run workflow
# This tests submodule update notifications
```

#### 2.2 **Test Failure Scenarios Safely**

Create a temporary test workflow to simulate failures:

```yaml
# Create: .github/workflows/test-discord-notifications.yml
name: Test Discord Notifications
on:
  workflow_dispatch:
    inputs:
      test_type:
        description: 'Test type'
        required: true
        type: choice
        options:
          - success
          - failure
          - warning

jobs:
  test-notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Simulate Success
        if: github.event.inputs.test_type == 'success'
        run: echo "✅ Simulating success scenario"

      - name: Simulate Failure
        if: github.event.inputs.test_type == 'failure'
        run: |
          echo "❌ Simulating failure scenario"
          exit 1

      - name: Simulate Warning
        if: github.event.inputs.test_type == 'warning'
        run: echo "⚠️ Simulating warning scenario"

      - name: Notify Discord on Success
        if: success()
        uses: sarisia/actions-status-discord@v1
        with:
          webhook: ${{ secrets.DISCORD_WEBHOOK_URL }}
          title: '✅ Test Notification - Success'
          description: 'This is a test success notification'
          color: 0x00ff00

      - name: Notify Discord on Failure
        if: failure()
        uses: sarisia/actions-status-discord@v1
        with:
          webhook: ${{ secrets.DISCORD_WEBHOOK }}
          title: '❌ Test Notification - Failure'
          description: 'This is a test failure notification'
          color: 0xff0000
```

### Phase 3: Test Production Workflows (Higher Risk)

⚠️ **Warning**: These tests will trigger actual operations. Do during low-traffic periods.

#### 3.1 **Test Low-Impact Workflows First**

**A. Test Generate Redirects (Safest Production Test):**

```bash
# Method 1: Make a small change to trigger the workflow
echo "# Test redirect generation" >> vault/test-redirect.md
git add vault/test-redirect.md
git commit -m "test: trigger redirect generation"
git push origin main

# Method 2: Trigger manually
# Go to Actions > Generate Redirects > Run workflow
```

**B. Test Arweave Deployment (Medium Impact):**

```bash
# Only test if you have test files marked for Arweave deployment
# Check db/vault.parquet for files with should_deploy_perma_storage = true
# Go to Actions > Deploy Markdown to Arweave > Run workflow
```

#### 3.2 **Test High-Impact Workflows (Use Caution)**

**A. Test Backup Workflow:**

```bash
# This is generally safe as it only reads data
# Go to Actions > Backup > Run workflow
# Monitor S3 bucket to ensure backup completes
```

**B. Test NFT Minting (Highest Impact):**

```bash
# ⚠️ CAUTION: This involves blockchain transactions
# Only test if you have test files marked for minting
# Check db/vault.parquet for files with should_mint = true AND minted_at IS NULL
# Go to Actions > Add post to mint contract > Run workflow
```

## Testing Checklist

### ✅ **Pre-Production Tests**

- [ ] Discord webhook responds to manual curl test
- [ ] Test git action workflow runs successfully
- [ ] Test notification workflow sends success message
- [ ] Test notification workflow sends failure message
- [ ] All secrets are properly configured

### ✅ **Production Workflow Tests**

- [ ] Generate Redirects workflow completes with notifications
- [ ] Backup workflow completes with notifications
- [ ] Dispatch workflow completes with notifications
- [ ] Arweave deployment workflow (if applicable)
- [ ] NFT minting workflow (if applicable)

### ✅ **Discord Notification Verification**

- [ ] Success notifications appear in Discord
- [ ] Failure notifications appear in Discord
- [ ] Notification formatting is correct
- [ ] Links to workflow runs work
- [ ] Color coding is appropriate (green/red/orange)

## Monitoring During Tests

### 1. **GitHub Actions Monitoring**

```bash
# Watch workflow runs in real-time
# Go to: https://github.com/dwarvesf/memo.d.foundation/actions
# Monitor each workflow run for:
# - Successful completion
# - Proper error handling
# - Discord notification steps
```

### 2. **Discord Channel Monitoring**

- Watch for notification messages in your Discord channel
- Verify message formatting and content
- Check that links work correctly
- Ensure no spam or duplicate messages

### 3. **Repository State Monitoring**

```bash
# Check that git operations work correctly
git log --oneline -10  # Check recent commits
git status            # Ensure clean working directory
git submodule status  # Verify submodule states
```

## Troubleshooting Common Issues

### Issue 1: Discord Notifications Not Appearing

```bash
# Check webhook URL is correct
# Verify DISCORD_WEBHOOK secret is set
# Test webhook manually with curl
# Check workflow logs for Discord notification steps
```

### Issue 2: Git Action Fails

```bash
# Check DWARVES_PAT secret has proper permissions
# Verify submodules are accessible
# Check for git configuration issues in logs
```

### Issue 3: Workflow Timeouts

```bash
# Monitor workflow execution times
# Check for hanging processes in logs
# Verify external API connectivity (OpenAI, Jina)
```

### Issue 4: Permission Errors

```bash
# Verify all required secrets are configured:
# - DISCORD_WEBHOOK
# - DWARVES_PAT
# - OPENAI_API_KEY
# - JINA_API_KEY
# - VAULT_* secrets
# - ARWEAVE_WALLET_JSON
```

## Rollback Plan

If issues are discovered during testing:

### 1. **Immediate Rollback**

```bash
# Disable problematic workflows
# Go to Actions > [Workflow Name] > Disable workflow

# Or revert specific commits
git revert [commit-hash]
git push origin main
```

### 2. **Selective Rollback**

```bash
# Remove only Discord notifications if git actions work
# Comment out Discord notification steps in workflows
# Keep the git action refactoring if it works
```

### 3. **Full Rollback**

```bash
# Restore from backup branch
git checkout main
git reset --hard testing-monitoring-[date]
git push --force-with-lease origin main
```

## Post-Testing Cleanup

### 1. **Remove Test Files**

```bash
# Remove test workflows
rm .github/workflows/test-git-action.yml
rm .github/workflows/test-discord-notifications.yml

# Remove test markdown files
rm vault/test-*.md

# Commit cleanup
git add -A
git commit -m "cleanup: remove testing files"
git push origin main
```

### 2. **Document Results**

```bash
# Create test results documentation
# Note any issues discovered
# Update monitoring documentation if needed
```

## Recommended Testing Order

1. **Start with manual Discord webhook test** (5 minutes)
2. **Test the reusable git action** (10 minutes)
3. **Test Discord notification scenarios** (15 minutes)
4. **Test generate-redirects workflow** (10 minutes)
5. **Test backup workflow** (20 minutes)
6. **Test dispatch workflow** (15 minutes)
7. **Test Arweave deployment** (if needed, 10 minutes)
8. **Test NFT minting** (if needed, 15 minutes)

**Total estimated testing time: 1-2 hours**

## Success Criteria

The testing is successful when:

- ✅ All workflows complete without errors
- ✅ Discord notifications appear for both success and failure cases
- ✅ Git operations work correctly across all submodules
- ✅ No duplicate or spam notifications
- ✅ All links in notifications work correctly
- ✅ Production operations continue normally

This comprehensive testing approach ensures that your monitoring system works reliably while minimizing risk to production operations.
