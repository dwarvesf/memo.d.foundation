import { ethers } from 'ethers';
import Arweave from 'arweave';
import fs from 'fs';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { glob } from 'glob';
import { resolve } from 'path';

const DEFAULT_IMAGE = 'ar://29D_NrcYOiOLMPVROGt5v3URNxftYCDK7z1-kyNPRT0';

// Initialize Arweave
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

// TypeScript interfaces
interface DeploymentResult {
  id: string;
  digest: string;
}

interface OutputResult extends DeploymentResult {
  file: string;
  skipped?: boolean;
  skipReason?: string;
}

// Define a proper type for the response object
interface ArweaveResponse {
  status: number;
  statusText?: string;
  data?: unknown;
}

/**
 * Gets the current date in YYYY-MM-DD format
 * @returns {string} - Current date string
 */
function getCurrentDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Generate content digest
function generateDigest(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Extract the first image from markdown content
function extractFirstImage(content: string): string | null {
  // Match Markdown image syntax: ![alt text](image-url)
  const markdownImageRegex = /!\[.*?\]\((.*?)\)/;
  // Match HTML image tags: <img src="image-url" />
  const htmlImageRegex = /<img.*?src=["'](.*?)["'].*?>/;

  const match =
    content.match(markdownImageRegex) || content.match(htmlImageRegex);

  if (match && match[1]) {
    // Return the captured image URL/path
    return match[1].trim();
  }

  return null;
}

// Check if the path is a URL
function isURL(path: string): boolean {
  return (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('ar://')
  );
}

// Resolve path for image
function resolvePath(filePath: string, path: string): string {
  if (isURL(path)) {
    return path;
  }

  // Remove leading slash if present
  let cleanPath = path.startsWith('/') ? path.substring(1) : path;
  cleanPath = resolve(filePath.split('/').slice(0, -1).join('/'), cleanPath);

  // Prefix with "vault" and normalize any double slashes
  const resolvedPath = cleanPath.replace(/\/+/g, '/');

  return resolvedPath;
}

/**
 * Extracts frontmatter data from a markdown file
 * @param {string} filePath - Path to the markdown file
 * @returns {Object} - The frontmatter data and content
 */
function extractFrontmatter(filePath: string): {
  data: Record<string, unknown>;
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
 * Updates the frontmatter of a markdown file
 * @param {string} filePath - Path to the markdown file
 * @param {Object} newFrontmatter - New frontmatter data to merge with existing
 */
function updateFrontmatter(
  filePath: string,
  newFrontmatter: Record<string, unknown>,
): void {
  try {
    // Get existing content with frontmatter
    const { data: existingFrontmatter, content } = extractFrontmatter(filePath);

    const updatedFrontmatter = yaml.dump(
      {
        ...existingFrontmatter,
        ...newFrontmatter,
      },
      { lineWidth: -1, forceQuotes: true },
    );

    const updatedContent = `---\n${updatedFrontmatter}---\n${content}`;

    // Write back to file
    fs.writeFileSync(filePath, updatedContent);
    console.log(`Updated frontmatter for ${filePath}`);
  } catch (error) {
    console.error(`Error updating frontmatter for ${filePath}:`, error);
    throw error;
  }
}

// Helper to fetch EVM address for a GitHub username
async function getAuthorEvmAddress(author: string): Promise<string> {
  try {
    const baseUrl = process.env.MOCHI_PROFILE_API;
    if (!baseUrl) {
      throw new Error('MOCHI_PROFILE_API is not set');
    }
    const url = `${baseUrl}/${author}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.associated_accounts)) return '';
    // Filter for evm-chain accounts
    const evmAccounts = data.associated_accounts.filter(
      (acc: any) => acc.platform === 'evm-chain',
    );
    if (evmAccounts.length === 0) return '';
    // Sort by updated_at descending
    evmAccounts.sort(
      (a: any, b: any) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    console.log(
      'Found EVM address for author ',
      author,
      ':',
      evmAccounts[0].platform_identifier,
    );
    return evmAccounts[0].platform_identifier || '';
  } catch (e) {
    console.error(`Failed to fetch EVM address for author ${author}:`, e);
    return '';
  }
}

// Upload image to Arweave
async function uploadImageToArweave(imagePath: string): Promise<string | null> {
  try {
    // Skip if already an Arweave URL
    if (imagePath.startsWith('ar://')) {
      return imagePath;
    }

    // Check if this is a dry run by checking if the --dry flag is in process.argv
    const isDryRun = process.argv.includes('--dry');
    if (isDryRun) {
      console.log(`[DRY RUN] Would upload image: ${imagePath}`);
      return 'ar://dry-run-image-id';
    }

    // Load wallet from environment variable
    const walletJson = process.env.ARWEAVE_WALLET_JSON;
    if (!walletJson) {
      throw new Error('ARWEAVE_WALLET_JSON environment variable is not set');
    }

    const wallet = JSON.parse(walletJson);

    // Read the image file
    let imageData;
    try {
      imageData = fs.readFileSync(imagePath);
    } catch (error) {
      console.error(`Error reading image file at ${imagePath}:`, error);
      return null;
    }

    // Determine the content type based on file extension
    const extension = imagePath.split('.').pop()?.toLowerCase();
    let contentType = 'image/jpeg'; // Default

    if (extension === 'png') contentType = 'image/png';
    else if (extension === 'gif') contentType = 'image/gif';
    else if (extension === 'svg') contentType = 'image/svg+xml';
    else if (extension === 'webp') contentType = 'image/webp';

    // Create transaction for the image
    const transaction = await arweave.createTransaction(
      { data: imageData },
      wallet,
    );

    // Add content type tag
    transaction.addTag('Content-Type', contentType);

    // Sign transaction
    await arweave.transactions.sign(transaction, wallet);

    // Submit transaction
    const response: ArweaveResponse =
      await arweave.transactions.post(transaction);

    if (response.status === 200 || response.status === 202) {
      return `ar://${transaction.id}`;
    } else {
      console.error(`Image upload failed with status: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error('Error uploading image to Arweave:', error);
    return null;
  }
}

async function deployContent(
  filePath: string,
  content: string,
  title: string,
  description: string,
  authors: string[],
  author_addresses: string[],
): Promise<DeploymentResult> {
  try {
    // Check if this is a dry run
    const isDryRun = process.argv.includes('--dry');
    if (isDryRun) {
      console.log(
        `[DRY RUN] Would deploy content to Arweave: "${title}" by ${authors.join(', ')}`,
      );
      return {
        id: 'dry-run-arweave-id',
        digest: 'dry-run-digest',
      };
    }

    // Load wallet from environment variable
    const walletJson = process.env.ARWEAVE_WALLET_JSON;
    if (!walletJson) {
      throw new Error('ARWEAVE_WALLET_JSON environment variable is not set');
    }

    const wallet = JSON.parse(walletJson);

    // Generate digest
    const digest = generateDigest(content);

    // Extract and upload the first image if found
    let imageUrl = DEFAULT_IMAGE;
    const imagePath = extractFirstImage(content);

    if (imagePath) {
      const resolvedPath = resolvePath(filePath, imagePath);
      const uploadedImageUrl = await uploadImageToArweave(resolvedPath);

      if (uploadedImageUrl) {
        imageUrl = uploadedImageUrl;
      }
    }

    // Create payload
    const payload = {
      content: content,
      timestamp: Date.now(),
      type: 'article',
      name: title,
      description: description,
      image: imageUrl,
      authors: authors,
      author_addresses,
    };

    // Convert to JSON
    const data = JSON.stringify(payload);

    // Create transaction
    const transaction = await arweave.createTransaction({ data }, wallet);

    // Add standard content type tag
    transaction.addTag('Content-Type', 'application/json');

    // Add additional tags
    transaction.addTag('digest', digest);

    // Sign transaction
    await arweave.transactions.sign(transaction, wallet);

    // Submit transaction
    const response: ArweaveResponse =
      await arweave.transactions.post(transaction);

    if (response.status === 200 || response.status === 202) {
      return {
        id: transaction.id,
        digest: digest,
      };
    } else {
      throw new Error(`Deployment failed with status: ${response.status}`);
    }
  } catch (error) {
    throw error;
  }
}

async function deployToArweave(filePath: string): Promise<OutputResult | null> {
  // Read the file
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Parse frontmatter
  const { data, content } = matter(fileContent);

  // Check if file should be deployed
  if (!data.should_deploy_perma_storage || data.perma_storage_id) {
    return null;
  }

  // Extract needed data
  const title = data.title || 'Untitled';
  const description = data.description || '';
  const authors = data.author
    ? [data.author]
    : data.authors
      ? data.authors
      : ['Anonymous'];

  // Fetch EVM addresses for all authors
  const author_addresses = await Promise.all(
    authors.map((author: string) => getAuthorEvmAddress(author)),
  );

  const result = await deployContent(
    filePath,
    content,
    title,
    description,
    authors,
    author_addresses,
  );

  // Update the file with the Arweave ID
  data.perma_storage_id = result.id;

  // Convert frontmatter back to YAML
  const newFrontmatter = yaml.dump(data, { lineWidth: -1, forceQuotes: true });

  // Update the file
  const updatedContent = `---\n${newFrontmatter}---\n${content}`;
  fs.writeFileSync(filePath, updatedContent);

  return {
    file: filePath,
    ...result,
  };
}

/**
 * Processes a single file and calls createTokenType with its perma_storage_id
 * @param {string} filePath - Path to the markdown file
 * @param {ethers.Contract} contract - The contract instance
 * @returns {Promise<Object>} - Transaction receipt
 */
async function mintOnContract(
  filePath: string,
  contract: ethers.Contract,
): Promise<unknown> {
  console.log(`Minting file: ${filePath}`);

  // Extract frontmatter data
  const { data: frontmatter } = extractFrontmatter(filePath);

  // Check if perma_storage_id exists
  if (!frontmatter.perma_storage_id) {
    console.log(`No perma storage id for ${filePath}, exiting...`);
    return;
  }

  // Check if already minted
  if (frontmatter.minted_at && frontmatter.token_id) {
    console.log(
      `File ${filePath} already has minted_at (${frontmatter.minted_at}) and token_id (${frontmatter.token_id}), skipping...`,
    );
    return;
  }

  const arweaveTxId = frontmatter.perma_storage_id;
  console.log(`Found perma_storage_id: ${arweaveTxId}`);

  try {
    // Check if token ID already exists for this arweaveTxId
    // This is optional and can be used to avoid unnecessary transactions
    try {
      const existingTokenId = await contract.getTokenId(arweaveTxId);
      if (existingTokenId && existingTokenId.toString() !== '0') {
        console.log(`Token ID already exists: ${existingTokenId.toString()}`);

        // Update frontmatter with minted_at and token_id
        updateFrontmatter(filePath, {
          minted_at: getCurrentDate(),
          token_id: existingTokenId.toString(),
        });

        console.log(`Updated ${filePath} with existing token_id`);
        return;
      }
    } catch (error) {
      // getTokenId might not exist or fail, proceed with creating new token
      console.log(
        'Could not check existing token ID, proceeding with creation: ',
        error,
      );
    }

    // Call the createTokenType function
    console.log(`Creating token type with arweaveTxId: ${arweaveTxId}`);
    const tx = await contract.createTokenType(arweaveTxId);

    console.log(`Transaction submitted: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Extract token ID from the transaction response
    let tokenId;

    // First try to get tokenId from the event
    try {
      const tokenTypeCreatedEvent = receipt.events?.find(
        (event: { event: string }) => event.event === 'TokenTypeCreated',
      );

      if (tokenTypeCreatedEvent && tokenTypeCreatedEvent.args) {
        tokenId = tokenTypeCreatedEvent.args.tokenId.toString();
        console.log(`Token ID from event: ${tokenId}`);
      }
    } catch (error) {
      console.log(
        'Could not extract token ID from event, will try other methods: ',
        error,
      );
    }

    // If event extraction failed, try to get it from the return value
    if (!tokenId) {
      try {
        // Try to get tokenId using getTokenId function after creation
        tokenId = await contract.getTokenId(arweaveTxId);
        tokenId = tokenId.toString();
        console.log(`Token ID from getTokenId: ${tokenId}`);
      } catch (error) {
        console.log('Could not get token ID from getTokenId function: ', error);
      }
    }

    if (tokenId) {
      console.log(`Final Token ID: ${tokenId}`);

      // Update frontmatter with minted_at and token_id
      updateFrontmatter(filePath, {
        minted_at: getCurrentDate(),
        token_id: tokenId,
      });

      console.log(`Updated ${filePath} with minted_at and token_id`);
    } else {
      console.log(`Could not obtain token ID for ${filePath}`);

      // Still update minted_at even if we couldn't get token_id
      updateFrontmatter(filePath, {
        minted_at: getCurrentDate(),
      });

      console.log(`Updated ${filePath} with minted_at only`);
    }

    return receipt;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Main function to process all files and interact with the contract
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);

    // Check for --dry flag
    const isDryRun = args.includes('--dry');
    if (isDryRun) {
      console.log('DRY RUN MODE: No actual transactions will be submitted');
    }

    // Remove --dry flag from arguments if present
    const globPatterns = args.filter(arg => arg !== '--dry');

    if (globPatterns.length === 0) {
      console.error(
        'Please provide at least one glob pattern for files to process',
      );
      process.exit(1);
    }

    console.log(`Using glob patterns: ${globPatterns.join(', ')}`);

    // Find files matching all glob patterns
    let allMatchedFiles: string[] = [];
    for (const pattern of globPatterns) {
      const matchedFiles = glob.sync(pattern);
      console.log(
        `Found ${matchedFiles.length} files matching pattern: ${pattern}`,
      );
      allMatchedFiles = [...allMatchedFiles, ...matchedFiles];
    }

    // Remove duplicates
    allMatchedFiles = [...new Set(allMatchedFiles)];
    console.log(`Total unique files found: ${allMatchedFiles.length}`);

    if (allMatchedFiles.length === 0) {
      console.log('No files to process');
      return;
    }

    // Ensure all paths are prefixed with "vault/" if they aren't already
    const filePaths = allMatchedFiles.map((path: string) =>
      path.startsWith('vault/') ? path : `vault/${path}`,
    );

    // Check if Arweave wallet is set (skip in dry run)
    if (!isDryRun && !process.env.ARWEAVE_WALLET_JSON) {
      throw new Error('ARWEAVE_WALLET_JSON environment variable is not set');
    }

    // Step 1: Deploy to Arweave
    console.log('=== STEP 1: DEPLOYING TO ARWEAVE ===');
    const deployResults: OutputResult[] = [];

    for (const filePath of filePaths) {
      try {
        if (isDryRun) {
          // In dry run, just read the file and check if it should be deployed
          const { data } = matter(fs.readFileSync(filePath, 'utf8'));

          if (!data.should_deploy_perma_storage || data.perma_storage_id) {
            const skipReason = data.perma_storage_id
              ? 'already deployed to Arweave'
              : 'not marked for deployment';

            console.log(
              `[DRY RUN] Skipped deploying ${filePath} to Arweave (${skipReason})`,
            );

            deployResults.push({
              file: filePath,
              id: (data.perma_storage_id as string) || 'none',
              digest: 'none',
              skipped: true,
              skipReason,
            });
          } else {
            console.log(`[DRY RUN] Would deploy ${filePath} to Arweave`);
            // Add a mock result for the dry run
            deployResults.push({
              file: filePath,
              id: 'dry-run-arweave-id',
              digest: 'dry-run-digest',
            });
          }
        } else {
          // Normal operation
          const result = await deployToArweave(filePath);
          if (result) {
            deployResults.push(result);
            console.log(
              `Successfully deployed ${filePath} to Arweave with ID: ${result.id}`,
            );
          } else {
            // Check why it was skipped
            const { data } = matter(fs.readFileSync(filePath, 'utf8'));
            const skipReason = data.perma_storage_id
              ? 'already deployed to Arweave'
              : 'not marked for deployment';

            console.log(
              `Skipped deploying ${filePath} to Arweave (${skipReason})`,
            );

            deployResults.push({
              file: filePath,
              id: (data.perma_storage_id as string) || 'none',
              digest: 'none',
              skipped: true,
              skipReason,
            });
          }
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Error deploying ${filePath} to Arweave:`, errorMessage);
      }
    }

    // Step 2: Mint on contract
    const filesToMint = deployResults.filter(result => !result.skipped);

    if (filesToMint.length > 0) {
      console.log('=== STEP 2: MINTING ON CONTRACT ===');

      // Get private key from environment variable (skip check in dry run)
      const privateKey = process.env.WALLET_PRIVATE_KEY;

      if (!isDryRun && !privateKey) {
        throw new Error('Private key is not set in environment variables');
      }

      // Contract address
      const contractAddress =
        process.env.CONTRACT_ADDRESS || '0xYourContractAddressHere';

      // RPC URL
      const rpcUrl =
        process.env.RPC_URL || 'https://ethereum-mainnet-rpc.allthatnode.com';

      // For dry run, we don't need to connect to the network or create contract instance
      let contract;

      if (!isDryRun) {
        // Connect to the Ethereum network
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Create a wallet from the private key
        const wallet = new ethers.Wallet(privateKey!, provider);

        // Contract ABI
        const contractAbi = [
          {
            inputs: [
              {
                internalType: 'string',
                name: 'arweaveTxId',
                type: 'string',
              },
            ],
            name: 'createTokenType',
            outputs: [
              {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
              },
            ],
            stateMutability: 'nonpayable',
            type: 'function',
          },
          {
            inputs: [
              {
                internalType: 'string',
                name: 'arweaveTxId',
                type: 'string',
              },
            ],
            name: 'getTokenId',
            outputs: [
              {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
              },
            ],
            stateMutability: 'view',
            type: 'function',
          },
          // Event for TokenTypeCreated
          {
            anonymous: false,
            inputs: [
              {
                indexed: true,
                internalType: 'uint256',
                name: 'tokenId',
                type: 'uint256',
              },
              {
                indexed: false,
                internalType: 'string',
                name: 'arweaveTxId',
                type: 'string',
              },
            ],
            name: 'TokenTypeCreated',
            type: 'event',
          },
        ];

        // Create a contract instance
        contract = new ethers.Contract(contractAddress, contractAbi, wallet);
      }

      // Process each file that was successfully deployed to Arweave
      for (const result of filesToMint) {
        if (isDryRun) {
          console.log(
            `[DRY RUN] Would mint ${result.file} with Arweave ID: ${result.id}`,
          );
        } else {
          await mintOnContract(result.file, contract!);
        }
      }

      if (isDryRun) {
        console.log('[DRY RUN] All files would be minted successfully');
      } else {
        console.log('All files minted successfully');
      }
    } else {
      console.log('No files were deployed to Arweave, skipping minting step');
    }

    console.log('=== PROCESS COMPLETED SUCCESSFULLY ===');
    // Log summary of minted results
    console.log('\nMinting Results Summary:');
    console.log('------------------------');

    const processedFiles = deployResults.filter(result => !result.skipped);
    const skippedFiles = deployResults.filter(result => result.skipped);

    if (isDryRun) {
      console.log(`Files that would be processed: ${processedFiles.length}`);
      console.log(`Files that would be skipped: ${skippedFiles.length}`);

      if (processedFiles.length > 0) {
        console.log('\nFiles that would be deployed and minted:');
        processedFiles.forEach(result => console.log(`- ${result.file}`));
      }

      if (skippedFiles.length > 0) {
        console.log('\nFiles that would be skipped:');
        skippedFiles.forEach(result =>
          console.log(`- ${result.file} (${result.skipReason})`),
        );
      }
    } else {
      console.log(
        `Files processed: ${processedFiles.map(r => r.file).join(', ') || 'None'}`,
      );
      console.log(`Files skipped: ${skippedFiles.length}`);
    }

    console.log(`\nTotal files found: ${filePaths.length}`);
    console.log(`Total files processed: ${processedFiles.length}`);
    console.log(`Total files skipped: ${skippedFiles.length}`);

    if (isDryRun) {
      console.log('\n[DRY RUN] No actual transactions were submitted');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the main function
main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in main execution:', error);
    process.exit(1);
  });
