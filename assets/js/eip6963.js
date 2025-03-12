// Map of allowed RDNS providers with their display names and icons
const rdnsMap = new Map([
  ["io.metamask", { name: "MetaMask", icon: "https://metamask.io/images/metamask-fox.svg", provider: null }],
  ["me.rainbow", { name: "Rainbow", icon: "https://rainbow.me/static/rainbow-logo.png", provider: null }],
  ["org.toshi", { name: "Coinbase Wallet", icon: "https://www.coinbase.com/assets/press/coinbase-icon.png", provider: null }],
  ["io.rabby", { name: "Rabby Wallet", icon: "https://rabby.io/assets/logo/rabby.svg", provider: null }],
]);

let mainWallet = null;
let dropdownVisible = false;

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

// Display detected providers as connect buttons.
function listProviders() {
  const connectBtn = document.querySelector(".connect-wallet");
  if (!connectBtn) return;
  connectBtn.addEventListener("click", () => connectWithProvider(mainWallet));

  window.addEventListener("eip6963:announceProvider", (event) => {
    const { info, provider } = event.detail;
    if (rdnsMap.has(info.rdns)) {
      const walletInfo = rdnsMap.get(info.rdns);
      walletInfo.provider = provider;
      rdnsMap.set(info.rdns, walletInfo);
      
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
  });

  // Notify event listeners and other parts of the dapp that a provider is requested.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

window.addEventListener("load", listProviders);
