# Web3 Integration Documentation

## Introduction

This repository implements web3 features allowing users to connect their crypto wallets and mint "proof-of-read" NFTs for articles they've consumed. This integration bridges traditional content with blockchain technology, providing the following benefits:

- **Verifiable engagement**: Readers can prove they've read specific content through on-chain attestations
- **Permanent storage**: Content is stored immutably on decentralized networks
- **Tokenized knowledge**: Articles become collectible NFTs with provable ownership
- **Community building**: Encourages deeper engagement with content through web3 mechanics

## How to Convert an Article into an NFT

The process of converting an article into a mintable NFT involves several automated steps. These steps are intentionally separated to provide more granular control over when content is permanently stored and when it's made available for minting.

### 1. Article Preparation

1. Create your article in markdown format with the appropriate frontmatter
2. To prepare for permanent storage, add the following field to the frontmatter, commit and push to the remote repo:
   ```yaml
   ---
   title: "Your Article Title"
   description: "Brief description of the article"
   author: "Author Name"
   should_deploy_perma_storage: true
   ---
   ```
3. After the article has been permanently stored and received its Arweave ID, you can later decide to make it mintable by adding, commit and push to the remote repo:
   ```yaml
   ---
   should_mint: true
   ---
   ```

> **Note**: These fields should not be added in the same commit. This separation provides precise control over the timing of permanent storage and NFT availability.

### 2. Permanent Storage on Arweave

When you push changes to the `main` branch with articles marked for storage, the GitHub workflow automatically:

1. Identifies articles marked for storage (`should_deploy_perma_storage: true`) that haven't been processed yet
2. Extracts the first image from the article (if present) and uploads it to Arweave
3. Uploads the article content to Arweave with appropriate metadata
4. Updates the article's frontmatter with the Arweave transaction ID (`perma_storage_id`)
5. Commits these changes back to the repository

The article is now permanently stored on Arweave and can be accessed via its transaction ID. At this point, it has storage but is not yet mintable.

### 3. NFT Contract Integration (Separate Process)

When you're ready to make the article available for minting (which could be immediately after storage or at a later date), you can add `should_mint: true` to the frontmatter and push to the `main` branch. This triggers a separate workflow that:

1. Identifies articles marked for minting (`should_mint: true`) that haven't been minted yet
2. Adds the article to the NFT contract on Base blockchain
3. Updates the article's frontmatter with:
   - `token_id`: The unique identifier for this article NFT
   - `minted_at`: Timestamp of when the article was added to the contract
4. Commits these changes back to the repository

This separation of storage and minting allows for content to be permanently stored while giving you control over when it becomes available as an NFT.

### 4. Frontend Integration

Once the article is stored on Arweave and registered in the NFT contract, readers can:

1. Connect their wallet using the provided interface
2. View the article with its minting status and metadata
3. Mint a "proof-of-read" NFT to their wallet
4. See their collection of article NFTs across the platform

## Technical Stack

### Permanent Decentralized Storage

**Arweave Protocol**
- Provides truly permanent data storage through a novel blockchain-like structure
- Each article and its associated images are stored as separate transactions
- Uses a one-time payment model for perpetual storage
- Content accessible via `https://{TRANSACTION_ID}.arweave.net`

**Implementation**
- Articles and images are uploaded via the Arweave JavaScript SDK
- Transaction IDs are stored in the article frontmatter
- Content hashing ensures data integrity

### NFT Contract on Base

**Base Blockchain**
- Ethereum L2 scaling solution by Coinbase
- EVM-compatible smart contracts for NFT minting
- Low gas fees ideal for frequent minting operations
- Mainnet for production, Sepolia testnet for development

**NFT Contract Features**
- ERC-1155 multi-token standard for efficient minting
- On-chain storage of content reference (Arweave links)
- Token IDs mapped to specific articles
- Minting functions accessible via wallet connection

### Frontend Integration

**Wallet Connection**
- EIP-6963 compliant wallet detection and connection
- Support for MetaMask, Rainbow, Coinbase Wallet, and Rabby
- Chain validation and network switching support
- Real-time connection state management

**Minting Interface**
- One-click minting for authenticated users
- Shows current minting status and collector counts
- Token previews with author attribution
- Network validation with automatic chain switching

## Development Workflow

This repository uses GitHub Actions to automate the web3 integration process:

1. `deploy-arweave.yml`: Handles permanent storage on Arweave
2. `add-mint-post.yml`: Manages NFT contract integration

Both workflows are triggered on:
- Manual dispatch via GitHub interface
- Pushes to the `main` branch that modify the content database

For detailed technical implementation, refer to the code in:
- `assets/js/eip6963.js` - Wallet connection logic
- `assets/js/mint-entry.js` - NFT minting interface
- `scripts/deploy-arweave.ts` - Arweave upload logic
- `scripts/add-mint-post.ts` - NFT contract integration 