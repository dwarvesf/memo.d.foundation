import { ethers } from "ethers";
import fs from "fs";
import matter from "gray-matter";
import yaml from "js-yaml";

/**
 * Extracts frontmatter data from a markdown file
 * @param {string} filePath - Path to the markdown file
 * @returns {Object} - The frontmatter data and content
 */
function extractFrontmatter(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
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
function updateFrontmatter(filePath, newFrontmatter) {
  try {
    // Get existing content with frontmatter
    const { data: existingFrontmatter, content } = extractFrontmatter(filePath);

    const updatedFrontmatter = yaml.dump({
      ...existingFrontmatter,
      ...newFrontmatter,
    });

    const updatedContent = `---\n${updatedFrontmatter}---\n\n${content}`;

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
function getCurrentDate() {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD format
}

/**
 * Processes a single file and calls createTokenType with its perma_storage_id
 * @param {string} filePath - Path to the markdown file
 * @param {ethers.Contract} contract - The contract instance
 * @returns {Promise<Object>} - Transaction receipt
 */
async function processFile(filePath, contract) {
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
      `File ${filePath} already has minted_at (${frontmatter.minted_at}) and token_id (${frontmatter.token_id}), skipping...`
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
      if (existingTokenId && existingTokenId.toString() !== "0") {
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
        "Could not check existing token ID, proceeding with creation"
      );
    }

    // Call the createTokenType function
    console.log(`Creating token type with arweaveTxId: ${arweaveTxId}`);
    const tx = await contract.createTokenType(arweaveTxId);

    console.log(`Transaction submitted: ${tx.hash}`);
    console.log("Waiting for confirmation...");

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Extract token ID from the transaction response
    // Since createTokenType now returns the token ID directly
    let tokenId;

    // First try to get tokenId from the event
    try {
      const tokenTypeCreatedEvent = receipt.events?.find(
        (event) => event.event === "TokenTypeCreated"
      );

      if (tokenTypeCreatedEvent && tokenTypeCreatedEvent.args) {
        tokenId = tokenTypeCreatedEvent.args.tokenId.toString();
        console.log(`Token ID from event: ${tokenId}`);
      }
    } catch (error) {
      console.log(
        "Could not extract token ID from event, will try other methods"
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
        console.log("Could not get token ID from getTokenId function");
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
    // Get command line arguments (file paths)
    const filePaths = process.argv.slice(2);

    if (filePaths.length === 0) {
      console.log("No files to process");
      return;
    }

    // Get private key from environment variable (set by GitHub Actions)
    const privateKey = process.env.WALLET_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error("Private key is not set in environment variables");
    }

    // Contract address - replace with your actual contract address
    const contractAddress =
      process.env.CONTRACT_ADDRESS || "0xYourContractAddressHere";

    // RPC URL - replace with your preferred provider
    const rpcUrl =
      process.env.RPC_URL || "https://ethereum-mainnet-rpc.allthatnode.com";

    // Connect to the Ethereum network
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    // Create a wallet from the private key
    const wallet = new ethers.Wallet(privateKey, provider);

    // Updated contract ABI to reflect the new function signature
    const contractAbi = [
      {
        inputs: [
          {
            internalType: "string",
            name: "arweaveTxId",
            type: "string",
          },
        ],
        name: "createTokenType",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "string",
            name: "arweaveTxId",
            type: "string",
          },
        ],
        name: "getTokenId",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      // Event for TokenTypeCreated
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "uint256",
            name: "tokenId",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "string",
            name: "arweaveTxId",
            type: "string",
          },
        ],
        name: "TokenTypeCreated",
        type: "event",
      },
    ];

    // Create a contract instance
    const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

    // Process each file sequentially
    for (const filePath of filePaths) {
      await processFile(filePath, contract);
    }

    console.log("All files processed successfully");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Execute the function
main()
  .then(() => {
    console.log("Function executed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error in main execution:", error);
    process.exit(1);
  });
