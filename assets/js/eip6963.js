let mainWallet = null;

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
    if (provider && info && info.rdns === "io.metamask") {
      mainWallet = provider;
      mainWallet.on("accountsChanged", (accs) =>
        updateButton(accs, connectBtn)
      );

      const accs = getAccounts(mainWallet);
      updateButton(accs, connectBtn);

      return;
    }
  });

  // Notify event listeners and other parts of the dapp that a provider is requested.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

window.addEventListener("load", listProviders);
