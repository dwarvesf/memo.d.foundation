import fs from 'fs';
import matter from 'gray-matter';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { title } from 'process';

const mcpDiscord = new Client({
  name: 'Discord MCP Client',
  version: '1.0.0',
});

/**
 * Extracts frontmatter data from a markdown file
 * @param {string} filePath - Path to the markdown file
 * @returns {Object} - The frontmatter data and content
 */
function extractFrontmatter(filePath: string): {
  data: Record<string, any>;
  content: string;
} {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return matter(fileContent);
  } catch (error) {
    console.error(`Error reading frontmatter from ${filePath}:`, error);
    throw error;
  }
}

/**
 * Sleep function to wait between retries
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Connect to MCP Discord with retry mechanism
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<void>}
 */
async function connectWithRetry(
  maxRetries = 3,
  initialDelay = 1000,
): Promise<void> {
  let retries = 0;
  let delay = initialDelay;

  while (retries <= maxRetries) {
    try {
      console.log(
        `Attempt ${retries + 1}/${maxRetries + 1} to connect to MCP Discord...`,
      );

      await mcpDiscord.connect(
        new StdioClientTransport({
          command: 'npx',
          args: ['@lmquang/mcp-discord-webhook@latest'],
          env: {
            PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
          },
        }),
      );

      console.log('Successfully connected to MCP Discord');
      return;
    } catch (error) {
      retries++;
      if (retries > maxRetries) {
        console.error(
          'Maximum retries reached. Failed to connect to MCP Discord.',
        );
        throw error;
      }

      console.warn(`Connection failed, retrying in ${delay}ms...`, error);
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }
}

/**
 * Call MCP tool with retry mechanism
 * @param {string} message - Message to send
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<void>}
 */
async function callToolWithRetry(
  message: string,
  title: string,
  maxRetries = 3,
  initialDelay = 1000,
): Promise<void> {
  let retries = 0;
  let delay = initialDelay;

  while (retries <= maxRetries) {
    try {
      console.log(
        `Attempt ${retries + 1}/${maxRetries + 1} to call Discord webhook...`,
      );

      await mcpDiscord.callTool({
        name: 'discord-send-embed',
        arguments: {
          username: 'Memo NFT',
          webhookUrl: process.env.DISCORD_WEBHOOK_URL,
          content: message,
          title: title,
          autoFormat: true,
          embeds: [],
        },
      });

      console.log('Successfully sent Discord message');
      return;
    } catch (error) {
      retries++;
      if (retries > maxRetries) {
        console.error(
          'Maximum retries reached. Failed to send Discord message.',
        );
        throw error;
      }

      console.warn(`Tool call failed, retrying in ${delay}ms...`, error);
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }
}

/**
 * Main function to process all files and interact with the contract
 */
async function main() {
  try {
    // Get command line arguments (file paths)
    // Skip the first two arguments (node and script path)
    const args = process.argv.slice(2);

    if (args.length === 0) {
      console.log('No files to process');
      return;
    }

    // Map each argument to a file path prefixed with 'vault/'
    const filePaths = args.map(path =>
      path.startsWith('vault/') ? path : `vault/${path}`,
    );

    console.log(`Arguments received: ${args.length} file paths`);

    let message =
      'Please compose a message to notify the community that the following notes have been minted:\n';
    let mintedFiles = '';
    for (const filePath of filePaths) {
      try {
        console.log(`Attempting to read file: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`Successfully read file: ${filePath}`);

        // Use matter directly on the content instead of calling extractFrontmatter
        const { data: frontmatter } = matter(content);

        console.log(`Frontmatter: ${JSON.stringify(frontmatter)}`);
        mintedFiles += `title: ${frontmatter.title} - url: https://memo.d.foundation/${filePath.replace('vault/', '').replace('.md', '')} - author: ${frontmatter.authors}\n`;
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        // Continue with next file instead of failing completely
        continue;
      }
    }
    if (mintedFiles.length === 0) {
      console.log('No minted files to notify');
      return;
    }
    message += mintedFiles;
    console.log('Message to send:', message);

    // Connect to MCP Discord with retry mechanism
    await connectWithRetry();

    // Call Discord webhook with retry mechanism
    await callToolWithRetry(message, '📢 New notes minted in the Memo');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the function
main()
  .then(() => {
    console.log('Function executed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in main execution:', error);
    process.exit(1);
  });
