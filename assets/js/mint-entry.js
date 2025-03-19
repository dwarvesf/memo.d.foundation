// NFT Contract details
const NFT_CONTRACT_ADDRESS = "0xb1e052156676750D193D800D7D91eA0C7cEeAdF0";

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
      decimals: 18
    },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"]
  },
  // Base mainnet (for future use)
  mainnet: {
    chainId: 8453,
    chainIdHex: "0x2105",
    chainName: "Base Mainnet",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"]
  }
};

// Set active network - change this to 'mainnet' when deploying to production
const ACTIVE_NETWORK = 'testnet';
const ACTIVE_CHAIN = CHAIN_CONFIG[ACTIVE_NETWORK];

// Only including the functions we need for the ABI
const NFT_CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "mintNFT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "readNFT",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "getMintCountByTokenId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "TokenMinted",
    "type": "event"
  }
];

// Main contract object
let nftContract = null;
// Current provider and signer
let provider = null;
let signer = null;

// Amount to mint per transaction
const MINT_AMOUNT = 1;

// Function to get the token ID from the container's data attribute
function getTokenId() {
  const container = document.querySelector('.mint-entry-container');
  if (!container) {
    console.error("Mint entry container not found");
    return null;
  }
  
  const tokenId = container.getAttribute('data-token-id');
  if (!tokenId) {
    console.error("Token ID not found in data attribute");
    return null;
  }
  
  return parseInt(tokenId, 10);
}

window.addEventListener("load", () => {
  initializeMintingInterface();
  setupEventListeners();
  
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

// Fetch the current mint count and update the progress without requiring a connected wallet
async function fetchAndUpdateMintCount() {
  try {
    const tokenId = getTokenId();
    if (!tokenId) {
      console.error("Cannot fetch mint count: Token ID is not available");
      return;
    }
    
    // Create a read-only provider and contract instance
    const readProvider = new ethers.providers.JsonRpcProvider(ACTIVE_CHAIN.rpcUrls[0]);
    const readOnlyContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, readProvider);
    
    // Get the mint count for this token ID
    const mintCount = await readOnlyContract.getMintCountByTokenId(tokenId);
    
    // Update the UI with the actual mint count
    updateMintProgressUI(mintCount.toNumber());
  } catch (error) {
    console.error("Failed to fetch mint count:", error);
  }
}

// Helper function to update the mint progress UI with a specific count
function updateMintProgressUI(count) {
  const mintCountDisplay = document.querySelector('.mint-count-display');
  
  if (mintCountDisplay) {
    mintCountDisplay.textContent = `${count} collected`;
  }
}

// Update the NFT contract address in the verification section
function updateNFTContractAddress() {
  const nftAddressElement = document.querySelector('.mint-entry-nft-address');
  if (nftAddressElement) {
    // Format address to show first 10 chars then ellipsis then last 6 chars
    const formattedAddress = `${NFT_CONTRACT_ADDRESS.substring(0, 10)}...${NFT_CONTRACT_ADDRESS.substring(NFT_CONTRACT_ADDRESS.length - 6)}`;
    nftAddressElement.textContent = formattedAddress;
    
    // Add link to blockchain explorer
    const explorerUrl = ACTIVE_CHAIN.blockExplorerUrls[0] + '/address/' + NFT_CONTRACT_ADDRESS;
    const linkElement = document.createElement('a');
    linkElement.href = explorerUrl;
    linkElement.target = '_blank';
    linkElement.rel = 'noopener noreferrer';
    linkElement.textContent = formattedAddress;
    
    nftAddressElement.textContent = '';
    nftAddressElement.appendChild(linkElement);
  }
}

// Initialize the minting interface and connect to existing wallet if available
async function initializeMintingInterface() {
  // Check if we already have a connected wallet from eip6963.js
  if (window.mainWallet) {
    await connectToContract(window.mainWallet);
  }
  
  // Update UI with initial state
  updateMintingUI(!!window.mainWallet);
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
          params: [{ chainId: ACTIVE_CHAIN.chainIdHex }]
        });
      } catch (switchError) {
        // If the chain hasn't been added, try to add it
        if (switchError.code === 4902) {
          await walletProvider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: ACTIVE_CHAIN.chainIdHex,
              chainName: ACTIVE_CHAIN.chainName,
              nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
              rpcUrls: ACTIVE_CHAIN.rpcUrls,
              blockExplorerUrls: ACTIVE_CHAIN.blockExplorerUrls
            }]
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
    nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, signer);
    
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
  const mintButton = document.querySelector('.mint-cta button');
  if (mintButton) {
    mintButton.addEventListener('click', handleMintButtonClick);
  }
}

// Handle mint button click
async function handleMintButtonClick() {
  if (!nftContract || !signer) {
    // If wallet isn't connected, trigger the connect wallet action
    const connectWalletButton = document.querySelector('.connect-wallet');
    if (connectWalletButton) {
      connectWalletButton.click();
    }
    return;
  }
  
  // Get the token ID for this entry
  const tokenId = getTokenId();
  if (!tokenId) {
    console.error("Cannot mint: Token ID is not available");
    return;
  }
  
  // Check if user has already minted this token
  try {
    const userAddress = await signer.getAddress();
    const balance = await nftContract.balanceOf(userAddress, tokenId);
    
    if (balance.gt(0)) {
      console.log("User has already minted this token");
      const mintButton = document.querySelector('.mint-cta button');
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
  const mintButton = document.querySelector('.mint-cta button');
  const originalText = mintButton.textContent;
  mintButton.textContent = "Minting...";
  mintButton.disabled = true;
  
  try {
    // Call the mintNFT function on the contract with tokenId and amount
    const tx = await nftContract.mintNFT(tokenId, MINT_AMOUNT);
    
    // Wait for transaction confirmation
    mintButton.textContent = "Confirming...";
    const receipt = await tx.wait();
    
    // Look for the TokenMinted event
    const mintEvent = receipt.events.find(event => 
      event.event === 'TokenMinted' || 
      (event.topics && event.topics[0] === ethers.utils.id("TokenMinted(address,uint256,uint256)"))
    );
    
    // Don't update verification data - it's not meant to be changed
    
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
    
    // If we have a connected provider and contract, use it
    if (nftContract) {
      const mintCount = await nftContract.getMintCountByTokenId(tokenId);
      updateMintProgressUI(mintCount.toNumber());
    } else {
      // If no connected wallet, use the read-only approach instead
      await fetchAndUpdateMintCount();
    }
  } catch (error) {
    console.error("Failed to update mint progress:", error);
  }
}

// Update the UI based on connection state
async function updateMintingUI(connected = false, errorMessage = null) {
  const mintButton = document.querySelector('.mint-cta button');
  const entryContainer = document.querySelector('.mint-entry-container');
  
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
      mintButton.textContent = errorMessage ? "Error" : "Connect Wallet to Mint";
      mintButton.disabled = !!errorMessage;
      mintButton.classList.remove("already-minted");
    }
  }
}