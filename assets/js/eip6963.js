// Fixed icon for wallets
const icons = {
  "io.rabby": "https://raw.githubusercontent.com/RabbyHub/logo/refs/heads/master/symbol.png",
  "io.metamask": "https://gist.githubusercontent.com/taycaldwell/4dfd00b206cdf2ff842da64aadfc96da/raw/1809c73c3fb45594c38e70355a0fd00908f18053/mm.svg",
  "me.rainbow": "https://framerusercontent.com/images/Hml6PtJwt03gwFtTRYmbpo7EarY.png?scale-down-to=512",
  "org.toshi": "https://raw.githubusercontent.com/mikolajroszak/base/refs/heads/main/logo/symbol/Base_Symbol_Blue.png",
}

// Map of allowed RDNS providers with their display names and icons
const rdnsMap = new Map([
  ["io.metamask", { name: "MetaMask", icon: icons["io.metamask"], provider: null }],
  ["me.rainbow", { name: "Rainbow", icon: icons["me.rainbow"], provider: null }],
  ["org.toshi", { name: "Coinbase Wallet", icon: icons["org.toshi"], provider: null }],
  ["io.rabby", { name: "Rabby Wallet", icon: icons["io.rabby"], provider: null }],
]);

let mainWallet = null;
let dropdownVisible = false;
let popperInstance = null;
let dropdown = null;

const getAccounts = (wallet) => {
  if (!wallet) return;
  try {
    return wallet._state?.accounts;
  } catch (error) {
    console.error("Cannot get wallet's accounts", error);
  }
};

// Connect to the selected provider using eth_requestAccounts.
const connectWithProvider = async (wallet) => {
  if (!wallet) return;
  const accs = getAccounts(wallet);
  try {
    if (accs?.[0]) {
      await wallet.request({
        method: "wallet_revokePermissions",
        params: [
          {
            eth_accounts: {},
          },
        ],
      });
      return;
    }
    await wallet.request({ method: "eth_requestAccounts" });
  } catch (error) {
    console.error("Failed to connect/disconnect provider:", error);
  }

  // Hide dropdown after connection attempt
  if (dropdown) {
    hideDropdown();
  }
};

function updateButton(accs, connectBtn) {
  if (!accs || !accs.length) {
    connectBtn.innerHTML = "Connect";
    connectBtn.classList.remove("wallet-connected");
    return;
  }
  const acc = accs[0];
  connectBtn.innerHTML = `${acc.slice(0, 5)}...${acc.slice(-2)}`;
  connectBtn.classList.add("wallet-connected");
}

// Create dropdown element for wallet selection
function createDropdown() {
  if (dropdown) return dropdown;

  dropdown = document.createElement('div');
  dropdown.id = 'wallet-dropdown';
  dropdown.style.display = 'none';

  document.body.appendChild(dropdown);
  return dropdown;
}

// Populate dropdown with available wallets
function populateDropdown() {
  if (!dropdown) return;

  dropdown.innerHTML = '';
  let hasWallets = false;

  rdnsMap.forEach((walletInfo, rdns) => {
    if (walletInfo.provider) {
      hasWallets = true;
      const item = document.createElement('div');

      if (walletInfo.icon) {
        const icon = document.createElement('img');
        icon.src = walletInfo.icon;
        icon.alt = walletInfo.name;
        item.appendChild(icon);
      }

      const name = document.createElement('span');
      name.textContent = walletInfo.name;
      item.appendChild(name);

      item.addEventListener('click', async () => {
        mainWallet = walletInfo.provider;
        await connectWithProvider(mainWallet);
        const accs = getAccounts(mainWallet);
        updateButton(accs, document.querySelector('.connect-wallet'));
      });

      dropdown.appendChild(item);
    }
  });

  if (!hasWallets) {
    const noWallets = document.createElement('div');
    noWallets.textContent = 'No compatible wallets detected';
    dropdown.appendChild(noWallets);
  }
}

// Show dropdown with Popper positioning
function showDropdown(referenceElement) {
  if (!dropdown) {
    dropdown = createDropdown();
  }

  populateDropdown();
  dropdown.style.display = 'flex';
  dropdownVisible = true;

  if (popperInstance) {
    popperInstance.destroy();
  }

  // Use Popper for positioning
  popperInstance = Popper.createPopper(referenceElement, dropdown, {
    placement: 'bottom-start',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, 8],
        },
      },
      {
        name: 'preventOverflow',
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
    dropdown.style.display = 'none';
    dropdownVisible = false;
  }
}

// Handle click outside to close dropdown
function handleClickOutside(event) {
  const connectBtn = document.querySelector('.connect-wallet');
  if (dropdownVisible && dropdown && !dropdown.contains(event.target) && connectBtn && !connectBtn.contains(event.target)) {
    hideDropdown();
  }
}

// Display detected providers as connect buttons.
function listProviders() {
  const connectBtn = document.querySelector(".connect-wallet");
  if (!connectBtn) return;

  // Create click handler for the connect button
  connectBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    // If already connected, disconnect when clicked
    if (mainWallet && getAccounts(mainWallet)?.length) {
      connectWithProvider(mainWallet);
      return;
    }

    // If not connected and we have multiple wallets, show dropdown
    const availableWallets = Array.from(rdnsMap.values()).filter(w => w.provider);
    if (availableWallets.length > 1) {
      if (dropdownVisible) {
        hideDropdown();
      } else {
        showDropdown(connectBtn);
      }
    } else if (availableWallets.length === 1) {
      // If only one wallet is available, connect directly
      mainWallet = availableWallets[0].provider;
      connectWithProvider(mainWallet);
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', handleClickOutside);

  // Close dropdown when pressing escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dropdownVisible) {
      hideDropdown();
    }
  });

  window.addEventListener("eip6963:announceProvider", (event) => {
    const { info, provider } = event.detail;
    if (rdnsMap.has(info.rdns)) {
      const walletInfo = rdnsMap.get(info.rdns);
      walletInfo.provider = provider;
      rdnsMap.set(info.rdns, walletInfo);
      console.log(walletInfo)

      // Setup account change listener
      provider.on("accountsChanged", (accs) => {
        if (mainWallet === provider) {
          updateButton(accs, connectBtn);
        }
      });

      // If no wallet is selected yet, use the first one
      if (!mainWallet) {
        mainWallet = provider;
        const accs = getAccounts(mainWallet);
        updateButton(accs, connectBtn);

        return;
      }
    }
  });

  // Notify event listeners and other parts of the dapp that a provider is requested.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

// Load Popper.js from CDN if not already available
function loadPopper() {
  if (window.Popper) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@popperjs/core@2.11.6/dist/umd/popper.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Initialize when the page loads
window.addEventListener("load", async () => {
  await loadPopper();
  listProviders();
});
