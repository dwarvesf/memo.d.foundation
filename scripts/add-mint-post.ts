import fs from 'fs';
import matter from 'gray-matter';
import * as yaml from 'js-yaml';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

/**
 * Extracts frontmatter data from a markdown file
 * @param {string} filePath - Path to the markdown file
 * @returns {Object} - The frontmatter data and content
 */
export function extractFrontmatter(filePath: string): {
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
export function updateFrontmatter(
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
      { lineWidth: -1 },
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

/**
 * Gets the current date in YYYY-MM-DD format
 * @returns {string} - Current date string
 */
export function getCurrentDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Contract ABI: createTokenType (write), getTokenId (read), and the
// TokenTypeCreated event minted transactions emit. `as const` so viem can
// infer arg/return types from the ABI instead of falling back to `unknown`.
export const contractAbi = [
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
] as const;

export interface MintClients {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: PrivateKeyAccount;
  contractAddress: Address;
}

/**
 * Processes a single file and calls createTokenType with its perma_storage_id
 * @param {string} filePath - Path to the markdown file
 * @param {MintClients} clients - viem clients + account + contract address to mint with
 * @returns {Promise<Object>} - Transaction receipt
 */
export async function processFile(
  filePath: string,
  clients: MintClients,
): Promise<unknown> {
  console.log(`Processing file: ${filePath}`);

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

  const arweaveTxId = frontmatter.perma_storage_id as string;
  console.log(`Found perma_storage_id: ${arweaveTxId}`);

  const { publicClient, walletClient, account, contractAddress } = clients;

  try {
    // Check if token ID already exists for this arweaveTxId
    // This is optional and can be used to avoid unnecessary transactions
    try {
      const existingTokenId = await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getTokenId',
        args: [arweaveTxId],
      });
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
    const hash = await walletClient.writeContract({
      address: contractAddress,
      abi: contractAbi,
      functionName: 'createTokenType',
      args: [arweaveTxId],
      account,
      // No chain object is configured on the client (see main()); pass
      // `null` explicitly to skip viem's chain-match assertion instead of
      // pinning a chain, so this keeps working against whatever chain
      // RPC_URL actually points at.
      chain: null,
    });

    console.log(`Transaction submitted: ${hash}`);
    console.log('Waiting for confirmation...');

    // Wait for the transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Extract token ID from the transaction response
    // Since createTokenType now returns the token ID directly
    let tokenId: string | undefined;

    // First try to get tokenId from the event
    try {
      const decodedLogs = parseEventLogs({
        abi: contractAbi,
        eventName: 'TokenTypeCreated',
        logs: receipt.logs,
      });

      const tokenTypeCreatedEvent = decodedLogs[0];

      if (tokenTypeCreatedEvent) {
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
        const fetchedTokenId = await publicClient.readContract({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'getTokenId',
          args: [arweaveTxId],
        });
        tokenId = fetchedTokenId.toString();
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
export async function main() {
  try {
    // Get command line arguments (file paths)
    const filePaths = process.argv[2]
      .trim()
      .split(',')
      .filter(Boolean)
      .map(path => `vault/${path}`);

    if (filePaths.length === 0) {
      console.log('No files to process');
      return;
    }

    // Get private key from environment variable (set by GitHub Actions)
    const rawPrivateKey = process.env.WALLET_PRIVATE_KEY;

    if (!rawPrivateKey) {
      throw new Error('Private key is not set in environment variables');
    }

    // ethers.Wallet accepted a private key with or without the `0x` prefix;
    // viem's privateKeyToAccount requires it, so normalize.
    const privateKey = (
      rawPrivateKey.startsWith('0x') ? rawPrivateKey : `0x${rawPrivateKey}`
    ) as `0x${string}`;

    // Contract address - replace with your actual contract address
    const contractAddress = (process.env.CONTRACT_ADDRESS ||
      '0xYourContractAddressHere') as Address;

    // RPC URL - replace with your preferred provider
    const rpcUrl =
      process.env.RPC_URL || 'https://ethereum-mainnet-rpc.allthatnode.com';

    const account = privateKeyToAccount(privateKey);
    const transport = http(rpcUrl);

    // No `chain` is passed here on purpose: it mirrors ethers.JsonRpcProvider's
    // auto network detection, so RPC_URL alone decides which chain (chainId,
    // fees, nonce) every read/write targets, same as the pre-viem script.
    const publicClient = createPublicClient({ transport });
    const walletClient = createWalletClient({ account, transport });

    const clients: MintClients = {
      publicClient,
      walletClient,
      account,
      contractAddress,
    };

    // Process each file sequentially
    for (const filePath of filePaths) {
      await processFile(filePath, clients);
    }

    console.log('All files processed successfully');
    console.log('::set-output name=mint-success::true');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute the function
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log('Function executed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error in main execution:', error);
      process.exit(1);
    });
}
