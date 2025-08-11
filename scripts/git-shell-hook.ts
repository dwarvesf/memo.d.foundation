#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

interface SubmoduleInfo {
  name: string;
  path: string;
  url: string;
  branch: string;
}

interface HookConfig {
  scriptUrl: string;
  hookType: 'pre-commit' | 'pre-push' | 'post-commit';
  submodules?: string[]; // If empty, applies to all submodules
}

const DEFAULT_LINTING_SCRIPT_URL = 'https://memo.d.foundation/tools/ci-lint.js';

class GitSubmoduleHookManager {
  private rootDir: string;
  private submodules: SubmoduleInfo[] = [];

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  /**
   * Parse .gitmodules file to get submodule information
   * Only processes submodules from dwarvesf organization
   */
  private parseGitmodulesFile(
    gitmodulesPath: string,
    basePath: string = '',
  ): SubmoduleInfo[] {
    if (!fs.existsSync(gitmodulesPath)) {
      return [];
    }

    const content = fs.readFileSync(gitmodulesPath, 'utf-8');
    const submodules: SubmoduleInfo[] = [];

    const sections = content.split(/\[submodule\s+["']?([^"'\]]+)["']?\]/);

    for (let i = 1; i < sections.length; i += 2) {
      const name = sections[i];
      const config = sections[i + 1];

      const pathMatch = config.match(/path\s*=\s*(.+)/);
      const urlMatch = config.match(/url\s*=\s*(.+)/);
      const branchMatch = config.match(/branch\s*=\s*(.+)/);

      if (pathMatch && urlMatch) {
        const url = urlMatch[1].trim();

        // Only process submodules from dwarvesf organization
        if (this.isDwarvesfSubmodule(url)) {
          const relativePath = pathMatch[1].trim();
          const fullPath = basePath
            ? path.join(basePath, relativePath)
            : relativePath;

          submodules.push({
            name: name.trim(),
            path: fullPath,
            url: url,
            branch: branchMatch ? branchMatch[1].trim() : 'main',
          });
        } else {
          console.log(`⏭ Skipping non-dwarvesf submodule: ${name} (${url})`);
        }
      }
    }

    return submodules;
  }

  /**
   * Check if a submodule URL belongs to the dwarvesf organization
   */
  private isDwarvesfSubmodule(url: string): boolean {
    // Support both HTTPS and SSH URL formats
    const httpsPattern = /^https:\/\/github\.com\/dwarvesf\//i;
    const sshPattern = /^git@github\.com:dwarvesf\//i;

    return httpsPattern.test(url) || sshPattern.test(url);
  }

  /**
   * Recursively discover all submodules, including nested ones
   */
  private parseGitmodules(): SubmoduleInfo[] {
    const allSubmodules: SubmoduleInfo[] = [];
    const processedPaths = new Set<string>();

    const discoverSubmodules = (
      basePath: string = '',
      currentDir: string = this.rootDir,
    ): void => {
      const gitmodulesPath = path.join(currentDir, '.gitmodules');

      // Avoid infinite loops
      const normalizedCurrentDir = path.resolve(currentDir);
      if (processedPaths.has(normalizedCurrentDir)) {
        return;
      }
      processedPaths.add(normalizedCurrentDir);

      const submodules = this.parseGitmodulesFile(gitmodulesPath, basePath);

      for (const submodule of submodules) {
        allSubmodules.push(submodule);

        // Check if this submodule has its own submodules
        const submoduleAbsolutePath = path.join(this.rootDir, submodule.path);

        if (
          fs.existsSync(submoduleAbsolutePath) &&
          this.isGitRepository(submoduleAbsolutePath)
        ) {
          // Recursively check for nested submodules
          discoverSubmodules(submodule.path, submoduleAbsolutePath);
        }
      }
    };

    // Start discovery from root
    discoverSubmodules();

    if (allSubmodules.length === 0) {
      console.log('No submodules found');
    } else {
      console.log(
        `Discovered ${allSubmodules.length} submodule(s) (including nested):`,
      );
      allSubmodules.forEach(sub => {
        const depth = sub.path.split('/').length - 1;
        const indent = '  '.repeat(depth);
        console.log(`${indent}- ${sub.name} (${sub.path})`);
      });
    }

    return allSubmodules;
  }

  /**
   * Check if a directory is a valid git repository
   */
  private isGitRepository(dir: string): boolean {
    const gitPath = path.join(dir, '.git');
    return fs.existsSync(gitPath);
  }

  /**
   * Get the actual git directory path (handles worktrees and submodules)
   */
  private getGitDir(repoPath: string): string | null {
    const gitPath = path.join(repoPath, '.git');

    if (!fs.existsSync(gitPath)) {
      return null;
    }

    const stat = fs.statSync(gitPath);

    if (stat.isDirectory()) {
      // Regular git repository
      return gitPath;
    } else if (stat.isFile()) {
      // Git worktree or submodule - read the gitdir reference
      const content = fs.readFileSync(gitPath, 'utf-8').trim();
      const match = content.match(/^gitdir:\s*(.+)$/);

      if (match) {
        const gitDir = match[1];
        // Handle relative paths
        if (path.isAbsolute(gitDir)) {
          return gitDir;
        } else {
          return path.resolve(repoPath, gitDir);
        }
      }
    }

    return null;
  }

  /**
   * List all submodules and their hook status
   */
  listHookStatus(): void {
    this.submodules = this.parseGitmodules();

    console.log('\nSubmodule Hook Status:');
    console.log('=====================');

    for (const submodule of this.submodules) {
      const submodulePath = path.join(this.rootDir, submodule.path);

      console.log(`\n📁 ${submodule.name} (${submodule.path})`);

      if (!fs.existsSync(submodulePath)) {
        console.log('   ⚠ Path does not exist');
        continue;
      }

      if (!this.isGitRepository(submodulePath)) {
        console.log('   ⚠ Not a git repository');
        continue;
      }

      const gitDir = this.getGitDir(submodulePath);
      if (!gitDir) {
        console.log('   ⚠ Could not determine git directory');
        continue;
      }

      const hooksDir = path.join(gitDir, 'hooks');
      const hookTypes = ['pre-commit', 'pre-push', 'post-commit', 'commit-msg'];

      for (const hookType of hookTypes) {
        const hookPath = path.join(hooksDir, hookType);
        if (fs.existsSync(hookPath)) {
          const stats = fs.statSync(hookPath);
          const isExecutable =
            (stats.mode & parseInt('755', 8)) === parseInt('755', 8);
          console.log(
            `   ${isExecutable ? '✓' : '⚠'} ${hookType}${isExecutable ? '' : ' (not executable)'}`,
          );
        } else {
          console.log(`   ✗ ${hookType}`);
        }
      }
    }
  }

  /**
   * Remove hooks from all submodules
   */
  removeHooksFromSubmodules(hookType: string, submodules?: string[]): void {
    this.submodules = this.parseGitmodules();

    for (const submodule of this.submodules) {
      const submodulePath = path.join(this.rootDir, submodule.path);

      // Check if specific submodules were requested
      if (submodules && submodules.length > 0) {
        if (
          !submodules.includes(submodule.name) &&
          !submodules.includes(submodule.path)
        ) {
          continue;
        }
      }

      if (
        !fs.existsSync(submodulePath) ||
        !this.isGitRepository(submodulePath)
      ) {
        continue;
      }

      const gitDir = this.getGitDir(submodulePath);
      if (!gitDir) {
        continue;
      }

      const hookPath = path.join(gitDir, 'hooks', hookType);

      if (fs.existsSync(hookPath)) {
        fs.unlinkSync(hookPath);
        console.log(`✓ Removed ${hookType} hook from ${submodulePath}`);
      }
    }
  }

  /**
   * Setup automatic hook installation for submodules
   */
  async setupSubmodulesHooks(
    scriptUrl: string,
    hookType: string,
    modules?: string[],
  ): Promise<void> {
    console.log('🚀 Setting up automatic hook installation for submodules...');

    await this.createSubmoduleStandaloneScripts(scriptUrl, hookType, modules);

    const HOOK_NAME = hookType.toUpperCase();

    console.log('\n✅ Setup submodule(s) hook complete!');
    console.log('\n📖 Next steps:');
    console.log('   1. Commit and push the new setup files');
    console.log(
      `   2. Individual submodule setup: cd <submodule> && ./${hookType}-hook.sh install`,
    );
    console.log(
      `   3. See ${HOOK_NAME}_HOOK_SETUP.md for detailed instructions`,
    );
  }

  /**
   * Create standalone hook installation scripts in each submodule
   */
  private async createSubmoduleStandaloneScripts(
    scriptUrl: string,
    hookType: string,
    modules?: string[],
  ): Promise<void> {
    this.submodules = this.parseGitmodules();

    if (this.submodules.length === 0) {
      console.log('⚠ No submodules found to create standalone scripts');
      return;
    }

    console.log(
      '\n📝 Creating standalone hook installation scripts in submodules...',
    );

    for (const submodule of this.submodules) {
      const submodulePath = path.join(this.rootDir, submodule.path);

      if (!fs.existsSync(submodulePath)) {
        console.log(`⚠ Submodule path does not exist: ${submodulePath}`);
        continue;
      }

      if (!this.isGitRepository(submodulePath)) {
        console.log(`⚠ Not a git repository: ${submodulePath}`);
        continue;
      }

      // Check if specific submodules were requested
      if (modules && modules.length > 0) {
        if (
          !modules.includes(submodule.name) &&
          !modules.includes(submodule.path)
        ) {
          console.log(
            `⏭ Skipping submodule ${submodule.name} (${submodule.path})`,
          );
          continue;
        }
      }

      try {
        await this.createSubmoduleInstallScript(
          submodulePath,
          submodule.name,
          scriptUrl,
          hookType,
        );
        await this.createSubmoduleReadme(
          submodulePath,
          submodule.name,
          scriptUrl,
          hookType,
        );
        console.log(
          `✓ Created ${hookType}-hook.sh and README in ${submodule.name} (${submodule.path})`,
        );
      } catch (error) {
        console.error(
          `✗ Failed to create scripts in ${submodule.path}:`,
          error,
        );
      }
    }
  }

  /**
   * Create combined hook management script in a submodule
   */
  private async createSubmoduleInstallScript(
    submodulePath: string,
    submoduleName: string,
    scriptUrl: string,
    hookType: string,
  ): Promise<void> {
    const scriptPath = path.join(submodulePath, `${hookType}-hook.sh`);

    const combinedScript = `#!/bin/bash

# Combined Git Hook Management Script for ${submoduleName}
# This script can install or remove ${hookType} hooks for this repository
# Auto-generated by git-shell-hook.ts

set -e

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Configuration
SCRIPT_URL="${scriptUrl}"
HOOK_TYPE="${hookType}"
REPO_NAME="${submoduleName}"

# Function to show usage
show_usage() {
    echo "Usage: \$0 [install|remove|status]"
    echo ""
    echo "Commands:"
    echo "  install  - Install ${hookType} hook"
    echo "  remove   - Remove ${hookType} hook"
    echo "  status   - Show hook status"
    echo ""
    echo "Examples:"
    echo "  \$0 install"
    echo "  \$0 remove"
    echo "  \$0 status"
}

# Function to get git directory (handles worktrees and submodules)
get_git_dir() {
    local repo_path="\$1"
    local git_path="\${repo_path}/.git"
    
    if [ ! -e "\$git_path" ]; then
        return 1
    fi
    
    if [ -d "\$git_path" ]; then
        # Regular git repository
        echo "\$git_path"
    elif [ -f "\$git_path" ]; then
        # Git worktree or submodule - read the gitdir reference
        local git_dir=\$(grep "^gitdir:" "\$git_path" | cut -d' ' -f2-)
        if [[ "\$git_dir" = /* ]]; then
            # Absolute path
            echo "\$git_dir"
        else
            # Relative path
            echo "\$(cd "\$repo_path" && cd "\$git_dir" && pwd)"
        fi
    else
        return 1
    fi
}

# Function to install hook
install_hook() {
    echo "🔧 Installing \${HOOK_TYPE} hook for \${REPO_NAME}..."
    
    # Check if we're in a git repository
    if [ ! -d ".git" ] && [ ! -f ".git" ]; then
        echo -e "\${RED}❌ Error: Not in a git repository root directory\${NC}"
        echo "Please run this script from the root of the \${REPO_NAME} repository"
        exit 1
    fi

    echo -e "\${BLUE}📋 Hook Configuration:\${NC}"
    echo "   Repository: \${REPO_NAME}"
    echo "   Script URL: \${SCRIPT_URL}"
    echo "   Hook Type: \${HOOK_TYPE}"
    echo ""

    # Get the actual git directory
    GIT_DIR=\$(get_git_dir ".")
    if [ -z "\$GIT_DIR" ]; then
        echo -e "\${RED}❌ Error: Could not determine git directory\${NC}"
        exit 1
    fi

    HOOKS_DIR="\${GIT_DIR}/hooks"
    HOOK_PATH="\${HOOKS_DIR}/\${HOOK_TYPE}"

    echo "📁 Git directory: \${GIT_DIR}"
    echo "🪝 Hook path: \${HOOK_PATH}"
    echo ""

    # Create hooks directory if it doesn't exist
    if [ ! -d "\$HOOKS_DIR" ]; then
        echo "📁 Creating hooks directory..."
        mkdir -p "\$HOOKS_DIR"
    fi

    # Create the hook script
    echo "📝 Creating \${HOOK_TYPE} hook..."

    cat > "\$HOOK_PATH" << 'EOF'
#!/bin/bash

# Auto-generated git hook for ${submoduleName}
# This hook fetches and executes a script from: ${scriptUrl}

set -e

echo "Running ${hookType} hook for ${submoduleName}..."
echo "Fetching script from: ${scriptUrl}"

# Create temporary file for the script
TEMP_SCRIPT=\$(mktemp)
trap 'rm -f "\$TEMP_SCRIPT"' EXIT

# Fetch the script using curl (fallback to wget if curl not available)
if command -v curl >/dev/null 2>&1; then
    if ! curl -sSL "${scriptUrl}" -o "\$TEMP_SCRIPT"; then
        echo "Error: Failed to fetch script using curl"
        exit 1
    fi
elif command -v wget >/dev/null 2>&1; then
    if ! wget -q "${scriptUrl}" -O "\$TEMP_SCRIPT"; then
        echo "Error: Failed to fetch script using wget"
        exit 1
    fi
else
    echo "Error: Neither curl nor wget is available"
    exit 1
fi

# Check if the script was downloaded successfully
if [ ! -s "\$TEMP_SCRIPT" ]; then
    echo "Error: Downloaded script is empty"
    exit 1
fi

# Execute the script with Node.js if it's a TypeScript/JavaScript file
if [[ "${scriptUrl}" == *.ts ]] || [[ "${scriptUrl}" == *.js ]]; then
    # Check if we're in a Node.js project directory
    if [ -f "package.json" ] || [ -f "tsconfig.json" ]; then
        # Try to use tsx for TypeScript files, fallback to node
        if [[ "${scriptUrl}" == *.ts ]] && command -v tsx >/dev/null 2>&1; then
            echo "Executing TypeScript script with tsx..."
            tsx "\$TEMP_SCRIPT"
        elif command -v node >/dev/null 2>&1; then
            echo "Executing script with node..."
            node "\$TEMP_SCRIPT"
        else
            echo "Error: Node.js not found"
            exit 1
        fi
    else
        echo "Warning: Not in a Node.js project directory, but trying to execute anyway..."
        if command -v node >/dev/null 2>&1; then
            node "\$TEMP_SCRIPT"
        else
            echo "Error: Node.js not found"
            exit 1
        fi
    fi
else
    # For other script types, make executable and run directly
    chmod +x "\$TEMP_SCRIPT"
    "\$TEMP_SCRIPT"
fi

echo "${hookType} hook completed successfully for ${submoduleName}"
EOF

    # Make the hook executable
    chmod +x "\$HOOK_PATH"

    echo -e "\${GREEN}✅ Successfully installed \${HOOK_TYPE} hook!\${NC}"
    show_status
}

# Function to remove hook
remove_hook() {
    echo "🗑️ Removing \${HOOK_TYPE} hook for \${REPO_NAME}..."
    
    # Check if we're in a git repository
    if [ ! -d ".git" ] && [ ! -f ".git" ]; then
        echo -e "\${RED}❌ Error: Not in a git repository root directory\${NC}"
        exit 1
    fi

    # Get the actual git directory
    GIT_DIR=\$(get_git_dir ".")
    if [ -z "\$GIT_DIR" ]; then
        echo -e "\${RED}❌ Error: Could not determine git directory\${NC}"
        exit 1
    fi

    HOOKS_DIR="\${GIT_DIR}/hooks"
    HOOK_PATH="\${HOOKS_DIR}/\${HOOK_TYPE}"

    echo "📁 Git directory: \${GIT_DIR}"
    echo "🪝 Hook path: \${HOOK_PATH}"
    echo ""

    # Remove the hook if it exists
    if [ -f "\$HOOK_PATH" ]; then
        echo "🗑️ Removing \${HOOK_TYPE} hook..."
        rm -f "\$HOOK_PATH"
        echo -e "\${GREEN}✅ Successfully removed \${HOOK_TYPE} hook\${NC}"
    else
        echo -e "\${YELLOW}⚠ No \${HOOK_TYPE} hook found to remove\${NC}"
    fi

    show_status
}

# Function to show hook status
show_status() {
    # Get the actual git directory
    GIT_DIR=\$(get_git_dir ".")
    if [ -z "\$GIT_DIR" ]; then
        echo -e "\${RED}❌ Error: Could not determine git directory\${NC}"
        exit 1
    fi

    HOOKS_DIR="\${GIT_DIR}/hooks"
    HOOK_PATH="\${HOOKS_DIR}/\${HOOK_TYPE}"

    echo ""
    echo "📊 Hook Status for \${REPO_NAME}:"
    if [ -f "\$HOOK_PATH" ]; then
        if [ -x "\$HOOK_PATH" ]; then
            echo -e "   ✓ \${HOOK_TYPE} hook installed and executable"
        else
            echo -e "   ⚠ \${HOOK_TYPE} hook installed but not executable"
        fi
    else
        echo -e "   ✗ \${HOOK_TYPE} hook not installed"
    fi
    echo ""
}

# Main script logic
case "\${1:-install}" in
    install)
        install_hook
        echo -e "\${GREEN}🎉 Hook installation complete for \${REPO_NAME}!\${NC}"
        echo ""
        echo "Available commands:"
        echo "  ./${hookType}-hook.sh install  - Reinstall hook"
        echo "  ./${hookType}-hook.sh remove   - Remove hook"
        echo "  ./${hookType}-hook.sh status   - Check hook status"
        echo ""
        echo "The hook will now run automatically on git \${HOOK_TYPE} operations."
        ;;
    remove)
        remove_hook
        echo -e "\${GREEN}🎉 Hook removal complete for \${REPO_NAME}!\${NC}"
        ;;
    status)
        show_status
        ;;
    *)
        echo -e "\${RED}❌ Error: Unknown command '\$1'\${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac
`;

    fs.writeFileSync(scriptPath, combinedScript, { mode: 0o755 });
  }

  /**
   * Create README.md for hook scripts in a submodule
   */
  private async createSubmoduleReadme(
    submodulePath: string,
    submoduleName: string,
    scriptUrl: string,
    hookType: string,
  ): Promise<void> {
    const hookTypeUppercase = hookType.toUpperCase().replace('-', '_');
    const readmePath = path.join(
      submodulePath,
      hookTypeUppercase + '_HOOK_README.md',
    );

    const readme = `# Git Hooks for ${submoduleName}

This repository includes automated git hooks to ensure code quality and consistency.

## Quick Setup

### Install Hooks
\`\`\`bash
./${hookType}-hook.sh install
\`\`\`

### Remove Hooks (if needed)
\`\`\`bash
./${hookType}-hook.sh remove
\`\`\`

### Check Hook Status
\`\`\`bash
./${hookType}-hook.sh status
\`\`\`

## How It Works

### Hook Configuration
- **Repository**: ${submoduleName}
- **Hook Type**: ${hookType}
- **Script URL**: ${scriptUrl}

### Dynamic Script Execution
The installed hook will:
1. Download the latest script from the configured URL on each git operation
2. Execute the script with appropriate runtime (tsx for TypeScript, node for JavaScript)
3. Provide clear feedback on success or failure

### Supported Operations
- **${hookType}**: Runs ${hookType === 'pre-commit' ? 'before commits are created' : hookType === 'pre-push' ? 'before pushes are sent to remote' : 'after commits are created'}

## Available Commands

The \`${hookType}-hook.sh\` script supports the following commands:

- \`install\` - Install the ${hookType} hook (default if no command specified)
- \`remove\` - Remove the ${hookType} hook
- \`status\` - Show current hook status

## Manual Commands

### Check Hook Status
\`\`\`bash
ls -la .git/hooks/${hookType}
\`\`\`

### Test Hook Manually
\`\`\`bash
.git/hooks/${hookType}
\`\`\`

### Reinstall Hook
\`\`\`bash
./${hookType}-hook.sh install
\`\`\`

## Troubleshooting

### Hook Not Running
1. Check if hook is installed: \`./${hookType}-hook.sh status\`
2. Check if hook is executable: \`test -x .git/hooks/${hookType} && echo "Executable" || echo "Not executable"\`
3. Reinstall hook: \`./${hookType}-hook.sh install\`

### Network Issues
- Hooks require internet connection to fetch scripts
- Check if script URL is accessible: \`curl -I ${scriptUrl}\`
- Verify firewall/proxy settings

### Runtime Issues
- For TypeScript scripts: Ensure tsx is available (\`npm install -g tsx\`)
- For JavaScript scripts: Ensure Node.js is available (\`node --version\`)

### Git Submodule Issues
- If you're working in a submodule, the hook paths may be different
- The scripts handle both regular git repositories and submodules automatically

## Security Considerations

- Hooks execute scripts downloaded from: ${scriptUrl}
- Scripts are downloaded fresh for each git operation
- Temporary files are securely cleaned up after execution
- Only run this setup if you trust the script source

## Support

If you encounter issues:
1. Check the main repository's HOOK_SETUP.md for detailed documentation
2. Verify your git and Node.js setup
3. Test the script URL manually in a browser
4. Contact the repository maintainers

---

*This hook setup ensures consistent code quality for ${submoduleName} while providing easy installation and management.*
`;

    fs.writeFileSync(readmePath, readme);
  }

  /**
   * Create GitHub Actions workflow files for linting in submodules
   */
  async setupGithubActionsWorkflows(
    lintScriptUrl: string,
    modules?: string[],
    workflowName: string = 'markdown-lint',
    triggerEvents: string[] = ['push', 'pull_request'],
  ): Promise<void> {
    console.log(
      '🚀 Setting up GitHub Actions workflows for markdown linting...',
    );

    this.submodules = this.parseGitmodules();

    if (this.submodules.length === 0) {
      console.log('⚠ No submodules found to create GitHub Actions workflows');
      return;
    }

    console.log('\n📝 Creating GitHub Actions workflow files in submodules...');

    for (const submodule of this.submodules) {
      const submodulePath = path.join(this.rootDir, submodule.path);

      if (!fs.existsSync(submodulePath)) {
        console.log(`⚠ Submodule path does not exist: ${submodulePath}`);
        continue;
      }

      if (!this.isGitRepository(submodulePath)) {
        console.log(`⚠ Not a git repository: ${submodulePath}`);
        continue;
      }

      // Check if specific submodules were requested
      if (modules && modules.length > 0) {
        if (
          !modules.includes(submodule.name) &&
          !modules.includes(submodule.path)
        ) {
          console.log(
            `⏭ Skipping submodule ${submodule.name} (${submodule.path})`,
          );
          continue;
        }
      }

      try {
        await this.createGithubActionsWorkflow(
          submodulePath,
          submodule.name,
          lintScriptUrl,
          workflowName,
          triggerEvents,
        );
        console.log(
          `✓ Created GitHub Actions workflow in ${submodule.name} (${submodule.path})`,
        );
      } catch (error) {
        console.error(
          `✗ Failed to create GitHub Actions workflow in ${submodule.path}:`,
          error,
        );
      }
    }

    console.log('\n✅ GitHub Actions workflow setup complete!');
    console.log('\n📖 Next steps:');
    console.log('   1. Commit and push the new workflow files');
    console.log(
      '   2. GitHub Actions will run automatically on configured trigger events',
    );
    console.log(
      '   3. Check the Actions tab in each repository for workflow status',
    );
  }

  /**
   * Create a GitHub Actions workflow file in a submodule
   */
  private async createGithubActionsWorkflow(
    submodulePath: string,
    submoduleName: string,
    lintScriptUrl: string,
    workflowName: string,
    triggerEvents: string[],
  ): Promise<void> {
    // Create .github/workflows directory if it doesn't exist
    const workflowsDir = path.join(submodulePath, '.github', 'workflows');
    if (!fs.existsSync(workflowsDir)) {
      fs.mkdirSync(workflowsDir, { recursive: true });
    }

    const workflowPath = path.join(workflowsDir, `${workflowName}.yml`);

    // Determine the script execution method based on URL extension
    const isTypeScript = lintScriptUrl.endsWith('.ts');
    const isJavaScript = lintScriptUrl.endsWith('.js');

    let executeCommand = '';
    if (isTypeScript) {
      executeCommand = 'npx tsx ${{ runner.temp }}/lint-script.ts';
    } else if (isJavaScript) {
      executeCommand = 'node ${{ runner.temp }}/lint-script.js';
    } else {
      executeCommand =
        'chmod +x ${{ runner.temp }}/lint-script && ${{ runner.temp }}/lint-script';
    }

    // Add auto-commit and PR comment steps after formatting
    const autoCommitStep = `
      - name: Commit and push changes
        if: \${{ github.event_name == 'pull_request' && steps.markdown-lint.outputs.fixed > 0 }}
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git fetch origin \${{ github.head_ref }}:\${{ github.head_ref }}
          git checkout \${{ github.head_ref }}
          git add .
          if ! git diff --cached --quiet; then
            git commit -m "chore: automatic formatting (sentence case, prettier, lint fixes) [skip ci]"
            git push origin HEAD:\${{ github.head_ref }}
          else
            echo "No changes to commit."
          fi`;

    const prCommentStep = `
      - name: Add PR comment with formatting summary
        if: \${{ github.event_name == 'pull_request' && steps.markdown-lint.outputs.fixed > 0 }}
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          header: "formatting-summary"
          message: |
            🤖 Automatic Formatting Applied

            **Files formatted:** \${{ steps.markdown-lint.outputs.fixed }}
            **Changes made:**
            \${{ steps.markdown-lint.outputs.changed-made }}

            View workflow run: [View Run](\${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }})`;

    const triggerSection = triggerEvents.reduce((acc, event) => {
      if (event === 'push' || event === 'pull_request') {
        acc += `  ${event}:\n`;
        acc += `    branches:\n`;
        acc += `      - main\n`;
        acc += `      - master\n`;
        acc += `    paths:\n`;
        acc += `      - '**/*.md'\n`;
        acc += `      - '**/*.mdx'\n`;
      } else {
        acc += `  ${event}:\n`;
      }
      return acc;
    }, '');

    const concurrencyGroup = '${{ github.repository }}-linting-workflow';
    const changedFilesEnvText = 'CHANGED_FILES: ${{ steps.changed-files.outputs.all_changed_files }}';

    const workflowContent = `name: ${workflowName.charAt(0).toUpperCase() + workflowName.slice(1)} Check

# Auto-generated GitHub Actions workflow for ${submoduleName}
# Runs markdown linting using script from: ${lintScriptUrl}

on:
${triggerSection}
  workflow_dispatch: # Allow manual trigger

concurrency:
  group: ${concurrencyGroup}
  cancel-in-progress: false

jobs:
  lint:
    name: Markdown Lint
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 1
          submodules: false # Avoid checking out submodules to speed up the process

      - name: Install Pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10
          run_install: false

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install dependencies
        run: |
          # Install tsx for TypeScript execution if needed
          ${isTypeScript ? 'npm install -g tsx' : '# No TypeScript dependencies needed'}
          
          # Install any project dependencies if package.json exists
          if [ -f "package.json" ]; then
            pnpm install
          fi

      - name: Download lint script
        run: |
          echo "📥 Downloading lint script from: ${lintScriptUrl}"
          curl -sSL "${lintScriptUrl}" -o \${{ runner.temp }}/lint-script${isTypeScript ? '.ts' : isJavaScript ? '.js' : ''}

          # Verify download
          if [ ! -s "\${{ runner.temp }}/lint-script${isTypeScript ? '.ts' : isJavaScript ? '.js' : ''}" ]; then
            echo "❌ Error: Downloaded script is empty"
            exit 1
          fi
          
          echo "✅ Script downloaded successfully"
      
      - name: Get changed files
        id: changed-files
        uses: tj-actions/changed-files@v46.0.5
        with:
          separator: ','

      - name: Run markdown linting
        id: markdown-lint
        run: |
          echo "🔍 Running markdown linting for ${submoduleName}..."
          ${executeCommand}
        env:
          # Pass any environment variables needed by the linting script
          GITHUB_ACTIONS: true
          REPO_NAME: ${submoduleName}
          OPENROUTER_API_KEY: \${{ secrets.OPENROUTER_API_KEY }}
          GITHUB_EVENT_NAME: \${{ github.event_name }}
          ${changedFilesEnvText}
${autoCommitStep}
${prCommentStep}
`;

    fs.writeFileSync(workflowPath, workflowContent);
  }
}

// CLI interface
function printUsage(): void {
  console.log(`
Git Submodule Hook Manager

Usage:
  npx -y tsx git-shell-hook.ts setup [options]       Setup automatic hook installation for submodules
  npx -y tsx git-shell-hook.ts remove [options]      Remove hooks from submodules
  npx -y tsx git-shell-hook.ts status                Show hook status for all submodules
  npx -y tsx git-shell-hook.ts github-actions [options] Create GitHub Actions workflow files for linting

Setup Options:
  --script-url <url>        GitHub raw URL of the script to execute (required)
  --hook-type <type>        Hook type: pre-commit, pre-push, post-commit (default: pre-commit)
  --modules <modules>       Comma-separated list of specific modules to setup (optional, default: all)

Remove Options:
  --hook-type <type>        Hook type to remove: pre-commit, pre-push, post-commit (default: pre-commit)
  --modules <modules>       Comma-separated list of specific modules to target (optional, default: all)

GitHub Actions Options:
  --script-url <url>        GitHub raw URL of the linting script (required)
  --modules <modules>       Comma-separated list of specific modules to target (optional, default: all)
  --workflow-name <name>    Name for the workflow (default: markdown-lint)
  --trigger-events <events> Comma-separated list of trigger events (default: push,pull_request)

Examples:
  # Setup automatic hook installation for submodules (creates scripts, docs, and installs hooks)
  npx -y tsx git-shell-hook.ts setup --script-url https://script-url.js

  # Setup hooks for specific modules only
  npx -y tsx git-shell-hook.ts setup --script-url https://script-url.js --modules vault,research

  # Create GitHub Actions workflow for all modules
  npx -y tsx git-shell-hook.ts github-actions --script-url https://raw.githubusercontent.com/dwarvesf/memo.d.foundation/main/scripts/formatter/ci-lint.js

  # Create GitHub Actions workflow for specific modules only
  npx -y tsx git-shell-hook.ts github-actions --script-url https://script-url.js --modules vault,research --workflow-name custom-lint

  # Remove hooks from all modules
  npx -y tsx git-shell-hook.ts remove --hook-type pre-commit

  # Remove hooks from specific modules
  npx -y tsx git-shell-hook.ts remove --hook-type pre-commit --modules vault

  # Show status of all hooks
  npx -y tsx git-shell-hook.ts status

Individual Submodule Management (after setup):
  # Install hooks in a specific submodule (for pre-commit hooks)
  cd <submodule> && ./pre-commit-hook.sh install

  # Remove hooks from a specific submodule
  cd <submodule> && ./pre-commit-hook.sh remove

  # Check hook status in a specific submodule
  cd <submodule> && ./pre-commit-hook.sh status

Hook-Type-Specific Scripts:
  # For pre-commit hooks
  cd <submodule> && ./pre-commit-hook.sh [install|remove|status]

  # For pre-push hooks
  cd <submodule> && ./pre-push-hook.sh [install|remove|status]

  # For post-commit hooks
  cd <submodule> && ./post-commit-hook.sh [install|remove|status]
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    return;
  }

  const command = args[0];
  const manager = new GitSubmoduleHookManager();

  try {
    let scriptUrl = DEFAULT_LINTING_SCRIPT_URL;
    let hookType: 'pre-commit' | 'pre-push' | 'post-commit' = 'pre-commit';
    let modules: string[] = [];
    let workflowName = 'markdown-lint';
    let triggerEvents = ['push', 'pull_request'];

    // Parse arguments
    for (let i = 1; i < args.length; i++) {
      switch (args[i]) {
        case '--script-url':
          scriptUrl = args[++i];
          break;
        case '--hook-type':
          hookType = args[++i] as any;
          break;
        case '--modules':
          modules = args[++i].split(',').map(s => s.trim());
          break;
        case '--workflow-name':
          workflowName = args[++i];
          break;
        case '--trigger-events':
          triggerEvents = args[++i].split(',').map(s => s.trim());
          break;
      }
    }

    switch (command) {
      case 'remove':
        manager.removeHooksFromSubmodules(hookType, modules);
        break;
      case 'status':
        manager.listHookStatus();
        break;

      case 'setup': {
        if (!scriptUrl) {
          console.error('Error: --script-url is required for setup');
          printUsage();
          process.exit(1);
        }

        await manager.setupSubmodulesHooks(
          scriptUrl,
          hookType,
          modules.length > 0 ? modules : undefined,
        );
        break;
      }

      case 'github-actions': {
        if (!scriptUrl) {
          console.error('Error: --script-url is required for github-actions');
          printUsage();
          process.exit(1);
        }

        await manager.setupGithubActionsWorkflows(
          scriptUrl,
          modules.length > 0 ? modules : undefined,
          workflowName,
          triggerEvents,
        );
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { GitSubmoduleHookManager };
export type { HookConfig };
