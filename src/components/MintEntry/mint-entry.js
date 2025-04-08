// NFT Contract details
// dev
// const NFT_CONTRACT_ADDRESS = "0xb1e052156676750D193D800D7D91eA0C7cEeAdF0";

// prod
const NFT_CONTRACT_ADDRESS = "0x07f3ed54e0b2D07cC522c4FC12EbA80E6D3A8DeB";

// Chain configuration - easy to switch between testnet and mainnet
const CHAIN_CONFIG = {
  // Base Sepolia testnet (current)
  testnet: {
    chainId: 84532,
    chainIdHex: "0x14A34",
    chainName: "Base Sepolia Testnet",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: [
      "https://sepolia.base.org",
      "https://base-sepolia-rpc.publicnode.com",
      "https://sepolia.base.meowrpc.com",
      "https://base-sepolia.blockpi.network/v1/rpc/public",
    ],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
  // Base mainnet (for future use)
  mainnet: {
    chainId: 8453,
    chainIdHex: "0x2105",
    chainName: "Base Mainnet",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: [
      "https://mainnet.base.org",
      "https://base.meowrpc.com",
      "https://base.publicnode.com",
      "https://1rpc.io/base",
      "https://base-mainnet.public.blastapi.io",
    ],
    blockExplorerUrls: ["https://basescan.org"],
  },
};

// Set active network - change this to 'mainnet' when deploying to production
const ACTIVE_NETWORK = "mainnet";
const ACTIVE_CHAIN = CHAIN_CONFIG[ACTIVE_NETWORK];

// Only including the functions we need for the ABI
const NFT_CONTRACT_ABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "mintNFT",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "readNFT",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    name: "getMintCountByTokenId",
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
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "id",
        type: "uint256",
      },
    ],
    name: "balanceOf",
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
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "TokenMinted",
    type: "event",
  },
];

// Cache for collector addresses to avoid redundant fetches
let collectorAddressesCache = {};

// Main contract object
let nftContract = null;
// Current provider and signer
let provider = null;
let signer = null;

// Amount to mint per transaction
const MINT_AMOUNT = 1;

// Function to get the token ID from the container's data attribute
function getTokenId() {
  const container = document.querySelector(".mint-entry-container");
  if (!container) {
    // No mint entry container on this page - this is expected on non-mintable pages
    return null;
  }

  const tokenId = container.getAttribute("data-token-id");
  if (!tokenId) {
    // Container exists but no token ID - also expected on certain pages
    return null;
  }

  return parseInt(tokenId, 10);
}

// Function to fetch and update NFT preview data
async function updateNFTPreview() {
  const container = document.querySelector(".mint-entry-container");
  if (!container) return;

  const permaStorageId = container.getAttribute("data-perma-storage-id");
  if (!permaStorageId) {
    console.error("No perma_storage_id found");
    return;
  }

  const FALLBACK_IMAGE_ID = "29D_NrcYOiOLMPVROGt5v3URNxftYCDK7z1-kyNPRT0";

  try {
    // Fetch NFT metadata from Arweave
    const response = await fetch(`https://arweave.net/${permaStorageId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch NFT metadata: ${response.status}`);
    }

    const data = await response.json();
    
    // Update NFT preview elements
    const preview = container.querySelector(".nft-preview");
    if (preview) {
      // Update image with fallback handling
      const previewImage = preview.querySelector(".nft-preview-image");
      if (previewImage) {
        let imageUrl;
        if (data.image) {
          const imageId = data.image.replace("ar://", "");
          imageUrl = `https://arweave.net/${imageId}`;
        } else {
          imageUrl = `https://arweave.net/${FALLBACK_IMAGE_ID}`;
        }

        // Set the image source and add error handling
        previewImage.onerror = () => {
          console.log("Image failed to load, using fallback");
          previewImage.src = `https://arweave.net/${FALLBACK_IMAGE_ID}`;
        };
        previewImage.src = imageUrl;
      }

      // Update title
      const previewTitle = preview.querySelector(".nft-preview-title");
      if (previewTitle && data.name) {
        previewTitle.textContent = data.name;
      }

      // Update author
      const previewAuthorName = preview.querySelector(".nft-preview-author-name");
      if (previewAuthorName && data.authors && data.authors.length > 0) {
        previewAuthorName.textContent = data.authors[0];
        
        // Also update the jdenticon with the new author
        const authorSvg = preview.querySelector("[data-jdenticon-value]");
        if (authorSvg) {
          authorSvg.setAttribute("data-jdenticon-value", data.authors[0]);
          if (window.jdenticon) {
            window.jdenticon.update(authorSvg);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error updating NFT preview:", error);
    
    // If there's an error, set the fallback image
    const previewImage = document.querySelector(".nft-preview-image");
    if (previewImage) {
      previewImage.src = `https://arweave.net/${FALLBACK_IMAGE_ID}`;
    }
  }
}

window.addEventListener("load", () => {
  initializeMintingInterface();
  setupEventListeners();
  updateNFTPreview();

  // Set NFT contract address in the verification section
  updateNFTContractAddress();

  // Start fetching the mint count to update the progress bar, even before wallet connection
  fetchAndUpdateMintCount();

  // Listen for wallet connection/disconnection events
  window.addEventListener("wallet:connectionChanged", async (event) => {
    const { connected, wallet } = event.detail;
    if (connected && wallet) {
      await connectToContract(wallet);
    }
    updateMintingUI(connected);
  });
});

// Fetch collector addresses by filtering events for a specific token ID
async function fetchCollectorAddresses(tokenId) {
  // Check cache first
  if (collectorAddressesCache[tokenId]) {
    return collectorAddressesCache[tokenId];
  }

  try {
    // Use the new API endpoint to fetch minters
    const apiUrl = `https://memo-nft-api-prod.fly.dev/minters/${tokenId}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract minter addresses from the API response
    const collectors = data.data.map(item => item.minter);
    
    // Store in cache
    collectorAddressesCache[tokenId] = collectors;
    
    return collectors;
  } catch (error) {
    console.error("Failed to fetch collector addresses:", error);
    return [];
  }
}

// Fetch the current mint count and update the progress without requiring a connected wallet
async function fetchAndUpdateMintCount() {
  try {
    const tokenId = getTokenId();
    if (!tokenId) {
      console.error("Cannot fetch mint count: Token ID is not available");
      return;
    }

    // Fetch data from the API endpoint
    const apiUrl = `https://memo-nft-api-prod.fly.dev/minters/${tokenId}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract collector addresses and total mint count
    const collectors = data.data.map(item => item.minter);
    const mintCount = data.total;

    // Update the UI with the mint count and collectors
    updateMintProgressUI(mintCount, collectors.reverse());
  } catch (error) {
    console.error("Failed to fetch mint count:", error);
    
    // Fallback to contract call if API fails
    try {
      // Create a read-only provider and contract instance
      const readProvider = new ethers.providers.JsonRpcProvider(
        ACTIVE_CHAIN.rpcUrls[0]
      );
      const readOnlyContract = new ethers.Contract(
        NFT_CONTRACT_ADDRESS,
        NFT_CONTRACT_ABI,
        readProvider
      );

      // Get the mint count for this token ID
      const mintCount = await readOnlyContract.getMintCountByTokenId(tokenId);
      updateMintProgressUI(mintCount.toNumber(), []);
    } catch (fallbackError) {
      console.error("Fallback mint count fetch failed:", fallbackError);
    }
  }
}

// Helper function to update the mint progress UI with a specific count and collector addresses
function updateMintProgressUI(count, collectors = []) {
  const mintCountDisplay = document.querySelector(".mint-count-display");

  if (mintCountDisplay) {
    // Clear previous content
    mintCountDisplay.innerHTML = "";

    if (count > 0) {
      // Create avatar container
      const avatarContainer = document.createElement("div");
      avatarContainer.className = "mint-avatars";

      // Display up to 3 collector avatars (or less if count < 3)
      const displayCount = Math.min(count, 3);
      for (let i = 0; i < displayCount; i++) {
        // Create div container for the SVG
        const div = document.createElement("div");

        // Generate identicon based on actual collector address if available
        // Otherwise fall back to a random value
        const address =
          collectors && collectors[i]
            ? collectors[i]
            : Math.random().toString(36).substring(2, 10);

        // Add to container
        avatarContainer.appendChild(div);

        // Render the identicon SVG inside the div
        if (window.jdenticon) {
          div.innerHTML = window.jdenticon.toSvg(address, 24);
        }

        // Set proper CSS class to ensure z-index works correctly
        if (i === displayCount - 1) {
          div.classList.add("last-avatar");
        }
      }

      // Add badge with count only if count > 0
      const countText = document.createElement("span");
      countText.className = "mint-count-badge";
      countText.textContent = `${count} collected`;

      avatarContainer.appendChild(countText);

      // Add the avatar container to the display
      mintCountDisplay.appendChild(avatarContainer);
    } else {
      // If count is 0, show default text
      mintCountDisplay.textContent = "Be the first to collect";
    }
  }
}

// Update the NFT contract address in the verification section
function updateNFTContractAddress() {
  const nftAddressElement = document.querySelector(".mint-entry-nft-address");
  if (nftAddressElement) {
    // Format address to show first 10 chars then ellipsis then last 6 chars
    const formattedAddress = `${NFT_CONTRACT_ADDRESS.substring(
      0,
      10
    )}...${NFT_CONTRACT_ADDRESS.substring(NFT_CONTRACT_ADDRESS.length - 6)}`;
    nftAddressElement.textContent = formattedAddress;

    // Add link to blockchain explorer
    const explorerUrl =
      ACTIVE_CHAIN.blockExplorerUrls[0] + "/address/" + NFT_CONTRACT_ADDRESS;
    const linkElement = document.createElement("a");
    linkElement.href = explorerUrl;
    linkElement.target = "_blank";
    linkElement.rel = "noopener noreferrer";
    linkElement.textContent = formattedAddress;

    nftAddressElement.textContent = "";
    nftAddressElement.appendChild(linkElement);
  }
}

// Initialize the minting interface and connect to existing wallet if available
async function initializeMintingInterface() {
  // Get the token ID for this entry
  const tokenId = getTokenId();
  
  // Only proceed if we have a valid token ID
  if (tokenId) {
    // Check if we already have a connected wallet from eip6963.js
    if (window.mainWallet) {
      await connectToContract(window.mainWallet);
    }

    // Update UI with initial state
    updateMintingUI(!!window.mainWallet);
  }
}

// Connect to contract with the provided wallet
async function connectToContract(walletProvider) {
  try {
    // Create ethers provider from the wallet provider
    provider = new ethers.providers.Web3Provider(walletProvider);

    // Check if we're on the correct chain
    const network = await provider.getNetwork();
    if (network.chainId !== ACTIVE_CHAIN.chainId) {
      // Prompt to switch to the correct chain
      try {
        await walletProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ACTIVE_CHAIN.chainIdHex }],
        });
      } catch (switchError) {
        // If the chain hasn't been added, try to add it
        if (switchError.code === -32603) {
          await walletProvider.request({
            method: "wallet_addEthereumChain",
            params: [ACTIVE_CHAIN],
          });
        } else {
          throw switchError;
        }
      }

      // Refresh provider after chain switch
      provider = new ethers.providers.Web3Provider(walletProvider);
    }

    // Get the signer and create contract instance
    signer = provider.getSigner();
    nftContract = new ethers.Contract(
      NFT_CONTRACT_ADDRESS,
      NFT_CONTRACT_ABI,
      signer
    );

    // Update UI to show connected state
    updateMintingUI(true);
  } catch (error) {
    console.error("Failed to connect to contract:", error);
    // Update UI to show error state
    updateMintingUI(false, error.message);
  }
}

// Set up event listeners for the UI
function setupEventListeners() {
  const mintButton = document.querySelector(".mint-cta button");
  if (mintButton) {
    mintButton.addEventListener("click", handleMintButtonClick);
  }
}

// Handle mint button click
async function handleMintButtonClick() {
  // Get the token ID for this entry
  const tokenId = getTokenId();
  if (!tokenId) {
    console.error("Cannot mint: Token ID is not available");
    return;
  }

  if (!nftContract || !signer) {
    console.log("Wallet not connected - deferring to eip6963.js handler");
    // eip6963.js will handle the wallet connection, we don't need to do anything here
    // The button will have our handler called first, which prevents this from running
    // until a wallet is connected 
    return;
  }

  console.log("Wallet connected, proceeding with mint");
  
  // Check if user has already minted this token
  try {
    const userAddress = await signer.getAddress();
    const balance = await nftContract.balanceOf(userAddress, tokenId);

    if (balance.gt(0)) {
      console.log("User has already minted this token");
      const mintButton = document.querySelector(".mint-cta button");
      if (mintButton) {
        mintButton.textContent = "Minted";
        mintButton.disabled = true;
        mintButton.classList.add("already-minted");
      }
      return;
    }
  } catch (error) {
    console.error("Error checking if user already minted:", error);
    // Continue with minting attempt even if check fails
  }

  // Get the mint button and show loading state
  const mintButton = document.querySelector(".mint-cta button");
  const originalText = mintButton.textContent;
  mintButton.textContent = "Minting...";
  mintButton.disabled = true;

  try {
    // Call the mintNFT function on the contract with tokenId and amount
    const tx = await nftContract.mintNFT(tokenId, MINT_AMOUNT);

    // Wait for transaction confirmation
    mintButton.textContent = "Confirming...";
    const receipt = await tx.wait();

    // Clear the collector address cache for this token ID to force refresh
    if (collectorAddressesCache[tokenId]) {
      delete collectorAddressesCache[tokenId];
    }

    // Update the mint count and progress bar
    updateMintProgress();

    // Restore button state
    mintButton.textContent = "Minted";
    mintButton.disabled = true;
    mintButton.classList.add("already-minted");
  } catch (error) {
    console.error("Minting failed:", error);
    mintButton.textContent = "Failed";
    setTimeout(() => {
      mintButton.textContent = "Mint";
      mintButton.disabled = false;
      mintButton.classList.remove("already-minted");
    }, 3000);
  }
}

// Update mint progress display
async function updateMintProgress() {
  try {
    const tokenId = getTokenId();
    if (!tokenId) {
      console.error("Cannot update mint progress: Token ID is not available");
      return;
    }

    // Clear the collector address cache for this token ID to force refresh
    if (collectorAddressesCache[tokenId]) {
      delete collectorAddressesCache[tokenId];
    }

    // Use the fetchAndUpdateMintCount function which now uses the API
    await fetchAndUpdateMintCount();
  } catch (error) {
    console.error("Failed to update mint progress:", error);
  }
}

// Update the UI based on connection state
async function updateMintingUI(connected = false, errorMessage = null) {
  const mintButton = document.querySelector(".mint-cta button");
  const entryContainer = document.querySelector(".mint-entry-container");

  if (connected) {
    // Update UI for connected state
    if (mintButton) {
      // Check if user has already minted this token
      try {
        const tokenId = getTokenId();
        if (tokenId !== null && nftContract && signer) {
          const userAddress = await signer.getAddress();
          const balance = await nftContract.balanceOf(userAddress, tokenId);
          if (balance.gt(0)) {
            mintButton.textContent = "Minted";
            mintButton.disabled = true;
            mintButton.classList.add("already-minted");
          } else {
            mintButton.textContent = "Mint";
            mintButton.disabled = false;
            mintButton.classList.remove("already-minted");
          }
        } else {
          mintButton.textContent = "Mint";
          mintButton.disabled = false;
        }
      } catch (error) {
        console.error("Error checking NFT balance:", error);
        mintButton.textContent = "Mint";
        mintButton.disabled = false;
      }
    }

    // Fetch and display the current mint progress
    updateMintProgress();
  } else {
    // Update UI for disconnected state
    if (mintButton) {
      mintButton.textContent = errorMessage
        ? "Error"
        : "Connect Wallet to Mint";
      mintButton.disabled = !!errorMessage;
      mintButton.classList.remove("already-minted");
    }
  }
}
