// Fixed icon for wallets
const icons = {
  "io.rabby":
    "https://raw.githubusercontent.com/RabbyHub/logo/refs/heads/master/symbol.png",
  "io.metamask":
    "https://gist.githubusercontent.com/taycaldwell/4dfd00b206cdf2ff842da64aadfc96da/raw/1809c73c3fb45594c38e70355a0fd00908f18053/mm.svg",
  "me.rainbow":
    "https://framerusercontent.com/images/Hml6PtJwt03gwFtTRYmbpo7EarY.png?scale-down-to=512",
  "org.toshi":
    "https://raw.githubusercontent.com/mikolajroszak/base/refs/heads/main/logo/symbol/Base_Symbol_Blue.png",
};

// Chain configuration - easy to switch between testnet and mainnet
const CHAIN_CONFIG = {
  // Base Sepolia testnet
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
    ],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  },
  // Base mainnet
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
    ],
    blockExplorerUrls: ["https://basescan.org"],
  },
};

// Set active network - change this to 'mainnet' when deploying to production
const ACTIVE_NETWORK = "mainnet";
const ACTIVE_CHAIN = CHAIN_CONFIG[ACTIVE_NETWORK];

// Set the required chain ID from the active chain configuration
const REQUIRED_CHAIN_ID = ACTIVE_CHAIN.chainId;

// Map of allowed RDNS providers with their display names and icons
const rdnsMap = new Map([
  [
    "io.metamask",
    { name: "MetaMask", icon: icons["io.metamask"], provider: null },
  ],
  [
    "me.rainbow",
    { name: "Rainbow", icon: icons["me.rainbow"], provider: null },
  ],
  [
    "org.toshi",
    { name: "Coinbase Wallet", icon: icons["org.toshi"], provider: null },
  ],
  [
    "io.rabby",
    { name: "Rabby Wallet", icon: icons["io.rabby"], provider: null },
  ],
]);

let mainWallet = null;
let dropdownVisible = false;
let popperInstance = null;
let tooltipInstance = null;
let dropdown = null;
let tooltip = null;
let wrongChain = false;
let isDisconnected = localStorage.getItem("isDisconnected");
isDisconnected =
  typeof isDisconnected === "string" ? isDisconnected === "true" : true;
let connectedRdns = localStorage.getItem("connectedRdns") || null;

// Function to check if user is on the correct chain
const checkChain = async (provider) => {
  if (!provider) return false;

  try {
    const chainId = await provider.request({ method: "eth_chainId" });
    // Convert hex chainId to decimal for comparison
    const chainIdDecimal = parseInt(chainId, 16);
    return chainIdDecimal === ACTIVE_CHAIN.chainId;
  } catch (error) {
    console.error("Error checking chain ID:", error);
    return false;
  }
};

// Function to switch to the correct chain
const switchChain = async (provider) => {
  if (!provider) return false;

  try {
    // First try to switch to the existing chain
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ACTIVE_CHAIN.chainIdHex }],
    });
    return true;
  } catch (error) {
    // If chain doesn't exist in wallet (error 4902), try to add it
    if (error.code === -32603) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [ACTIVE_CHAIN],
        });
        return true;
      } catch (addError) {
        console.error("Error adding chain:", addError);
        return false;
      }
    } else {
      console.error("Error switching chain:", error);
      return false;
    }
  }
};

// Create tooltip element for no wallet warning
function createTooltip() {
  if (tooltip) return tooltip;

  tooltip = document.createElement("div");
  tooltip.className = "wallet-tooltip";
  tooltip.innerHTML =
    "Please install a wallet extension (e.g. Rabby) to connect";

  const arrow = document.createElement("div");
  arrow.className = "wallet-tooltip-arrow";
  tooltip.appendChild(arrow);

  document.body.appendChild(tooltip);
  return tooltip;
}

// Show tooltip for no wallet warning
function showTooltip(referenceElement) {
  if (!tooltip) {
    tooltip = createTooltip();
  }

  tooltip.setAttribute("data-show", "");

  if (tooltipInstance) {
    tooltipInstance.setOptions((options) => ({
      ...options,
      modifiers: [
        ...options.modifiers,
        { name: "eventListeners", enabled: true },
      ],
    }));
    tooltipInstance.update();
  } else {
    tooltipInstance = Popper.createPopper(referenceElement, tooltip, {
      placement: "bottom",
      modifiers: [
        {
          name: "offset",
          options: {
            offset: [0, 8],
          },
        },
        {
          name: "arrow",
          options: {
            element: tooltip.querySelector(".wallet-tooltip-arrow"),
          },
        },
      ],
    });
  }
}

// Hide tooltip for no wallet warning
function hideTooltip() {
  if (!tooltip) return;

  tooltip.removeAttribute("data-show");

  if (tooltipInstance) {
    tooltipInstance.setOptions((options) => ({
      ...options,
      modifiers: [
        ...options.modifiers,
        { name: "eventListeners", enabled: false },
      ],
    }));
  }
}

// Helper function to update the RDNS for a provider
const updateRdnsForProvider = (provider) => {
  if (!provider) return null;

  for (const [rdns, walletInfo] of rdnsMap.entries()) {
    if (walletInfo.provider === provider) {
      connectedRdns = rdns;
      localStorage.setItem("connectedRdns", connectedRdns);
      return rdns;
    }
  }
  return null;
};

const getAccounts = async (wallet) => {
  if (!wallet) return [];
  try {
    const accounts = await wallet.request({ method: "eth_accounts" });
    return accounts;
  } catch (error) {
    console.error("Cannot get wallet's accounts", error);
    return [];
  }
};

// Connect to the selected provider using eth_requestAccounts.
const connectWithProvider = async (wallet) => {
  if (!wallet) return;
  const connectBtn = document.querySelector(".connect-wallet");

  try {
    const accounts = await getAccounts(wallet);

    if (!isDisconnected && accounts?.length) {
      // we cannot really disconnect from the provider, so we just set the mainWallet to null
      mainWallet = null;
      window.mainWallet = null;
      isDisconnected = true;
      localStorage.setItem("isDisconnected", isDisconnected);
      updateButton([], connectBtn);
      // Dispatch disconnect event
      window.dispatchEvent(
        new CustomEvent("wallet:connectionChanged", {
          detail: { connected: false, wallet: null },
        })
      );
      return;
    }
    isDisconnected = false;
    localStorage.setItem("isDisconnected", isDisconnected);
    await wallet
      .request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      })
      .catch(() => null);
    const newAccounts = await wallet.request({ method: "eth_requestAccounts" });

    // Update the button with the connected account
    if (newAccounts && newAccounts.length) {
      await updateButton(newAccounts, connectBtn);
    }

    // Dispatch connect event
    window.dispatchEvent(
      new CustomEvent("wallet:connectionChanged", {
        detail: { connected: true, wallet: wallet },
      })
    );

    // Setup account change listener
    wallet.on("accountsChanged", async (accounts) => {
      if (mainWallet === wallet) {
        window.mainWallet = mainWallet;
        await updateButton(accounts, connectBtn);
      }
    });

    // Setup chain change listener
    wallet.on("chainChanged", async (chainId) => {
      if (mainWallet === wallet) {
        const accounts = await getAccounts(wallet);
        await updateButton(accounts, connectBtn);
      }
    });
  } catch (error) {
    console.error("Failed to connect/disconnect provider:", error);
  }

  // Hide dropdown after connection attempt
  if (dropdown) {
    hideDropdown();
  }
};

async function updateButton(accounts, connectBtn) {
  if (
    !accounts ||
    !accounts.length ||
    localStorage.getItem("isDisconnected") === "true"
  ) {
    connectBtn.innerHTML = "Connect";
    connectBtn.classList.remove("wallet-connected");
    connectBtn.classList.remove("wrong-chain");
    wrongChain = false;
    // Dispatch disconnect event when accounts change to empty
    window.dispatchEvent(
      new CustomEvent("wallet:connectionChanged", {
        detail: { connected: false, wallet: null },
      })
    );
    return;
  }

  // Check if we're on the correct chain
  if (mainWallet) {
    const isCorrectChain = await checkChain(mainWallet);

    if (!isCorrectChain) {
      connectBtn.innerHTML = "Switch Chain";
      connectBtn.classList.add("wallet-connected");
      connectBtn.classList.add("wrong-chain");
      wrongChain = true;
      // Dispatch wrong chain event
      window.dispatchEvent(
        new CustomEvent("wallet:chainChanged", {
          detail: { correctChain: false, wallet: mainWallet },
        })
      );
      return;
    }
  }

  // We have accounts and correct chain
  const acc = accounts[0];
  connectBtn.innerHTML = `${acc.slice(0, 5)}...${acc.slice(-2)}`;
  connectBtn.classList.add("wallet-connected");
  connectBtn.classList.remove("wrong-chain");
  wrongChain = false;

  // Dispatch connect event when accounts change and are available
  window.dispatchEvent(
    new CustomEvent("wallet:connectionChanged", {
      detail: { connected: true, wallet: mainWallet },
    })
  );

  // Dispatch correct chain event
  window.dispatchEvent(
    new CustomEvent("wallet:chainChanged", {
      detail: { correctChain: true, wallet: mainWallet },
    })
  );
}

// Create dropdown element for wallet selection
function createDropdown() {
  if (dropdown) return dropdown;

  dropdown = document.createElement("div");
  dropdown.id = "wallet-dropdown";
  dropdown.style.display = "none";

  document.body.appendChild(dropdown);
  return dropdown;
}

// Populate dropdown with available wallets
function populateDropdown(referenceElement) {
  if (!dropdown) return;

  dropdown.innerHTML = "";
  let hasWallets = false;

  rdnsMap.forEach((walletInfo, rdns) => {
    if (walletInfo.provider) {
      hasWallets = true;
      const item = document.createElement("div");

      if (walletInfo.icon) {
        const icon = document.createElement("img");
        icon.src = walletInfo.icon;
        icon.alt = walletInfo.name;
        item.appendChild(icon);
      }

      const name = document.createElement("span");
      name.textContent = walletInfo.name;
      item.appendChild(name);

      item.addEventListener("click", async () => {
        mainWallet = walletInfo.provider;
        window.mainWallet = mainWallet;
        await connectWithProvider(mainWallet);
        
        // Get accounts
        const accs = await getAccounts(mainWallet);
        
        // Update header connect button
        const headerConnectBtn = document.querySelector(".connect-wallet");
        if (headerConnectBtn) {
          await updateButton(accs, headerConnectBtn);
        }
        
        // If the click came from the mint button, trigger wallet:connectionChanged event
        // so the mint-entry.js can update its UI
        if (referenceElement && referenceElement.closest('.mint-cta')) {
          window.dispatchEvent(
            new CustomEvent("wallet:connectionChanged", {
              detail: { connected: true, wallet: mainWallet },
            })
          );
        }
        
        // Store provider info
        updateRdnsForProvider(mainWallet);
      });

      dropdown.appendChild(item);
    }
  });

  if (!hasWallets) {
    const noWallets = document.createElement("div");
    noWallets.textContent = "No compatible wallets detected";
    dropdown.appendChild(noWallets);
  }
}

// Show dropdown with Popper positioning
function showDropdown(referenceElement, placement = "bottom-end") {
  // If dropdown is already visible and associated with the same element, hide it
  if (dropdownVisible && dropdown && dropdown.associatedElement === referenceElement) {
    console.log("Toggling dropdown off");
    hideDropdown();
    return;
  }
  
  console.log("Showing dropdown with placement:", placement);
  
  if (!dropdown) {
    dropdown = createDropdown();
  }

  // Store reference to the associated element
  dropdown.associatedElement = referenceElement;
  
  populateDropdown(referenceElement);
  dropdown.style.display = "flex";
  dropdownVisible = true;

  if (popperInstance) {
    popperInstance.destroy();
  }

  // Use Popper for positioning
  popperInstance = Popper.createPopper(referenceElement, dropdown, {
    placement: placement,
    modifiers: [
      {
        name: "offset",
        options: {
          offset: [0, 8],
        },
      },
      {
        name: "preventOverflow",
        options: {
          boundary: document.body,
        },
      },
    ],
  });
}

// Hide dropdown
function hideDropdown() {
  if (dropdown) {
    console.log("Hiding dropdown");
    dropdown.style.display = "none";
    dropdownVisible = false;
    dropdown.associatedElement = null;
    
    if (popperInstance) {
      popperInstance.destroy();
      popperInstance = null;
    }
  }
}

// Handle click outside to close dropdown
function handleClickOutside(event) {
  // Skip processing if it's a direct button click (we handle these separately)
  if (event.target.closest('.mint-cta button') || event.target.closest('.connect-wallet')) {
    return;
  }
  
  // Close dropdown if clicking outside dropdown
  if (dropdownVisible && dropdown && !dropdown.contains(event.target)) {
    console.log("Closing dropdown from outside click");
    hideDropdown();
  }
}

// Display detected providers as connect buttons.
async function listProviders() {
  const connectBtn = document.querySelector(".connect-wallet");
  if (!connectBtn) return;

  // Create click handler for the connect button
  connectBtn.addEventListener("click", async (e) => {
    e.stopPropagation();

    // If on wrong chain, try to switch chains
    if (wrongChain && mainWallet) {
      const switched = await switchChain(mainWallet);
      if (switched) {
        // After switching chain, update button state
        const accounts = await getAccounts(mainWallet);
        await updateButton(accounts, connectBtn);
      }
      return;
    }

    console.log(
      mainWallet,
      isDisconnected,
      localStorage.getItem("isDisconnected")
    );
    // If already connected, disconnect when clicked
    if (mainWallet && localStorage.getItem("isDisconnected") === "false") {
      const accounts = await getAccounts(mainWallet);
      if (accounts && accounts.length) {
        await connectWithProvider(mainWallet);
        return;
      }
    }

    // If not connected and we have multiple wallets, show dropdown
    const availableWallets = Array.from(rdnsMap.values()).filter(
      (w) => w.provider
    );
    if (availableWallets.length > 1) {
      if (dropdownVisible) {
        hideDropdown();
      } else {
        showDropdown(connectBtn);
      }
    } else if (availableWallets.length === 1) {
      // If only one wallet is available, connect directly
      mainWallet = availableWallets[0].provider;
      window.mainWallet = mainWallet;
      await connectWithProvider(mainWallet);

      // Find the RDNS for this provider and update it
      updateRdnsForProvider(mainWallet);

      // Get accounts and update the button UI
      const accounts = await getAccounts(mainWallet);
      await updateButton(accounts, connectBtn);
    }
  });

  // Setup inside listProviders
  // Close dropdown when clicking outside - use capture phase to ensure it runs first
  document.addEventListener("click", (event) => {
    console.log("Document click:", event.target);
    // Only process after a short delay to allow other handlers to run first
    setTimeout(() => handleClickOutside(event), 10);
  }, true);

  // Close dropdown when pressing escape key
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dropdownVisible) {
      console.log("Escape pressed, hiding dropdown");
      hideDropdown();
    }
  });

  window.addEventListener("eip6963:announceProvider", async (event) => {
    const { info, provider } = event.detail;
    if (rdnsMap.has(info.rdns)) {
      const walletInfo = rdnsMap.get(info.rdns);
      walletInfo.provider = provider;
      rdnsMap.set(info.rdns, walletInfo);

      // Setup account change listener
      provider.on("accountsChanged", async (accounts) => {
        if (mainWallet === provider) {
          window.mainWallet = mainWallet;
          await updateButton(accounts, connectBtn);
          
          // Also dispatch event for mint-entry.js to update its UI
          window.dispatchEvent(
            new CustomEvent("wallet:connectionChanged", {
              detail: { connected: accounts.length > 0, wallet: mainWallet },
            })
          );
        }
      });

      // Setup chain change listener
      provider.on("chainChanged", async (chainId) => {
        if (mainWallet === provider) {
          const accounts = await getAccounts(provider);
          await updateButton(accounts, connectBtn);
          
          // Also dispatch chain changed event for mint-entry.js
          const isCorrectChain = await checkChain(provider);
          window.dispatchEvent(
            new CustomEvent("wallet:chainChanged", {
              detail: { correctChain: isCorrectChain, wallet: mainWallet },
            })
          );
        }
      });

      // If no wallet is selected yet, use the stored connectedRdns
      if (!mainWallet && connectedRdns === info.rdns) {
        const accounts = await getAccounts(provider);
        if (accounts?.length) {
          mainWallet = provider;
          window.mainWallet = mainWallet;
          await updateButton(accounts, connectBtn);
          updateRdnsForProvider(mainWallet);
          return;
        }
      }
    }
  });

  // Notify event listeners and other parts of the dapp that a provider is requested.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

// Add a new function to handle mint button clicks
async function handleMintButtonClick(event) {
  // Stop event propagation to prevent immediate closing
  event.stopPropagation();
  
  const mintButton = event.currentTarget;
  console.log("Mint button clicked", mintButton);
  
  // If we already have a connected wallet, don't show the dropdown
  if (mainWallet && localStorage.getItem("isDisconnected") === "false") {
    return;
  }
  
  // Check if we have wallet providers
  const availableWallets = Array.from(rdnsMap.values()).filter(
    (w) => w.provider
  );
  
  if (availableWallets.length === 0) {
    // No wallets available, disable the button
    mintButton.disabled = true;
    mintButton.classList.add("no-wallet");
    return;
  }
  
  // If there are available wallets and we're not connected, show the dropdown
  if (availableWallets.length >= 1) {
    // Position the dropdown above the mint button
    showDropdown(mintButton, "top");
  }
}

// Initialize when the page loads
window.addEventListener("load", () => {
  // Check if we're on a page with a token_id
  const mintEntryContainer = document.querySelector(".mint-entry-container");
  const connectBtn = document.querySelector(".connect-wallet");
  
  // Only proceed if there's a mint-entry-container with token_id or the button is visible
  if ((mintEntryContainer && mintEntryContainer.getAttribute("data-token-id")) || 
      (connectBtn && window.getComputedStyle(connectBtn).display !== "none")) {
    // Initialize wallet connection
    listProviders();

    // Check for supported wallets after a delay to allow extensions to load
    setTimeout(() => {
      const availableWallets = Array.from(rdnsMap.values()).filter(
        (w) => w.provider
      );
      
      // Setup connect button tooltip if no wallets
      if (connectBtn && availableWallets.length === 0) {
        // No supported wallets found
        connectBtn.disabled = true;
        connectBtn.classList.add("no-wallet");

        // Setup tooltip events
        connectBtn.addEventListener("mouseenter", () => showTooltip(connectBtn));
        connectBtn.addEventListener("mouseleave", hideTooltip);
        connectBtn.addEventListener("focus", () => showTooltip(connectBtn));
        connectBtn.addEventListener("blur", hideTooltip);
      }
      
      // Find mint button and add click handler
      const mintButton = document.querySelector(".mint-cta button");
      if (mintButton) {
        console.log("Found mint button:", mintButton.textContent);
        
        if (availableWallets.length === 0) {
          // No wallets available, disable the button
          mintButton.disabled = true;
          mintButton.title = "Please install a wallet extension";
        } else {
          // Remove any existing click event listeners to avoid duplicates
          mintButton.removeEventListener("click", handleMintButtonClick);
          
          // Add click handler for the mint button to show wallet dropdown
          mintButton.addEventListener("click", handleMintButtonClick);
          console.log("Added click handler to mint button");
          
          // Ensure the class is set for identifying mint button in handleClickOutside
          mintButton.classList.add("wallet-trigger");
        }
      }
    }, 500); // Wait 0.5s to check for wallets
  }
});

// Export wallet connection functions for use in other scripts
window.connectWithProvider = connectWithProvider;
window.showDropdown = showDropdown;
window.hideDropdown = hideDropdown;
window.updateRdnsForProvider = updateRdnsForProvider;
window.rdnsMap = rdnsMap;
window.updateButton = updateButton;
