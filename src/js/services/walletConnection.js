// Connects MetaMask and exposes the connected account + web3 client
// to every other file (plain <script> tags share one global scope).

let connectedAccount;   // the address of the currently connected MetaMask account
let web3Client;         // the web3.js instance built from window.ethereum
const WALLET_LOGOUT_FLAG = "escrowLoggedOut";

// Reads the local profile that belongs to the connected wallet and current network.
const getHeaderProfile = () => {
  if (!connectedAccount || typeof loadSavedProfile !== "function") return null;

  const rawChainId = window.ethereum?.chainId || web3Client?.currentProvider?.chainId;
  const chainId = typeof rawChainId === "string" && rawChainId.startsWith("0x")
    ? Number.parseInt(rawChainId, 16)
    : Number(rawChainId);
  if (!Number.isInteger(chainId) || chainId <= 0) return null;

  return loadSavedProfile(localStorage, chainId, connectedAccount);
};

// Shows the saved name and avatar initials without exposing the public wallet address in the header.
const updateHeaderProfile = () => {
  const profileBox = document.getElementById("walletProfile");
  const avatar = document.getElementById("headerAvatar");
  const name = document.getElementById("headerName");
  if (!profileBox || !avatar || !name) return;

  if (!connectedAccount) {
    profileBox.classList.add("hidden");
    return;
  }

  const profile = getHeaderProfile() || {};
  const safeAvatar = typeof isSafeAvatarData === "function" && isSafeAvatarData(profile.avatar)
    ? profile.avatar
    : "";
  name.textContent = profile.name || "Unnamed user";
  avatar.textContent = safeAvatar ? "" : (typeof getProfileInitials === "function" ? getProfileInitials(profile.name) : "U");
  avatar.style.backgroundImage = safeAvatar ? `url("${safeAvatar}")` : "";
  avatar.classList.toggle("has-image", Boolean(safeAvatar));
  profileBox.classList.remove("hidden");
};

const KNOWN_CHAINS = {
  11155111: { name: "Sepolia", hex: "0xaa36a7" },
  1337: { name: "Ganache (1337)", hex: "0x539" },
  5777: { name: "Ganache (5777)", hex: "0x1691" },
  1: { name: "Mainnet", hex: "0x1" },
};

// Updates the network badge and live gas indicator in the header.
const updateNetworkAndGasUI = async () => {
  const badge = document.getElementById("networkBadge");
  const networkName = document.getElementById("networkName");
  const gasIndicator = document.getElementById("gasIndicator");
  if (!badge || !networkName) return;

  if (!window.ethereum) {
    networkName.textContent = "No Web3";
    badge.className = "network-badge network-offline";
    if (gasIndicator) gasIndicator.textContent = "⛽ --";
    return;
  }

  try {
    const rawChainId = window.ethereum.chainId || (web3Client && await web3Client.eth.getChainId());
    const chainId = typeof rawChainId === "string" && rawChainId.startsWith("0x")
      ? Number.parseInt(rawChainId, 16)
      : Number(rawChainId);

    const chain = KNOWN_CHAINS[chainId];
    if (chain) {
      networkName.textContent = chain.name;
      badge.className = "network-badge network-known";
    } else if (chainId) {
      networkName.textContent = "Chain " + chainId;
      badge.className = "network-badge network-unknown";
    } else {
      networkName.textContent = "Not connected";
      badge.className = "network-badge network-offline";
    }

    if (web3Client && gasIndicator) {
      try {
        const gasPriceWei = await web3Client.eth.getGasPrice();
        const gasGwei = Math.round(Number(web3Client.utils.fromWei(gasPriceWei, "gwei")));
        gasIndicator.textContent = "⛽ ~" + gasGwei + " Gwei";
      } catch (e) {
        gasIndicator.textContent = "⛽ Gas n/a";
      }
    }
  } catch (err) {
    console.warn("Could not load network details:", err);
  }
};

// Prompts the user to switch networks between Sepolia and Localhost with one click.
const handleNetworkSwitchPrompt = async () => {
  if (!window.ethereum) {
    showStatusMessage("MetaMask is not installed.", "error");
    return;
  }

  const rawChainId = window.ethereum.chainId;
  const currentChainId = typeof rawChainId === "string" && rawChainId.startsWith("0x")
    ? Number.parseInt(rawChainId, 16)
    : Number(rawChainId);

  const targetSepolia = currentChainId !== 11155111;
  const confirmMsg = targetSepolia
    ? "Switch your wallet network to Ethereum Sepolia Testnet (11155111)?"
    : "Switch your wallet network to Localhost / Ganache (1337 / 7545)?";

  if (!confirm(confirmMsg)) return;

  if (targetSepolia) {
    await requestChainSwitch("0xaa36a7", {
      chainId: "0xaa36a7",
      chainName: "Sepolia Test Network",
      nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
      rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"]
    });
  } else {
    await requestChainSwitch("0x539", {
      chainId: "0x539",
      chainName: "Ganache Localhost",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["http://127.0.0.1:7545"]
    });
  }
};

const requestChainSwitch = async (chainIdHex, chainParams) => {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError) {
    if (switchError.code === 4902 && chainParams) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [chainParams],
        });
      } catch (addError) {
        showFriendlyError(addError, "Adding network");
      }
    } else {
      showFriendlyError(switchError, "Switching network");
    }
  }
};

// Updates the shared header so the wallet action is clear on every page.
const updateWalletHeader = () => {
  const button = document.getElementById("walletButton");
  const roleBadge = document.getElementById("roleBadge");
  updateNetworkAndGasUI();
  if (!button) return;

  if (connectedAccount) {
    button.textContent = "Log out";
    button.classList.add("button-outline");
    button.classList.remove("button-dark");
    updateHeaderProfile();
  } else {
    button.textContent = "Connect wallet";
    button.classList.add("button-dark");
    button.classList.remove("button-outline");
    updateHeaderProfile();
    if (roleBadge) roleBadge.classList.add("hidden");
  }
};

// Copies the connected wallet account to clipboard with button feedback and toast.
const copyConnectedAccount = async (buttonElement = null) => {
  if (!connectedAccount) {
    showStatusMessage("No wallet connected to copy.", "warning");
    return;
  }
  const btn = buttonElement || document.getElementById("copyAddressBtn") || document.getElementById("copyAccountBtn");
  if (typeof copyTextToClipboard === "function") {
    await copyTextToClipboard(connectedAccount, "Wallet address", btn);
  }
};
const copyWalletAddress = copyConnectedAccount;

// Toggles display between shortened hash and full 42-character address for any element.
const toggleAddressDisplay = (elementId = "account", badgeId = "indexAddressHashBadge") => {
  let accountEl = document.getElementById(elementId);
  let badgeEl = badgeId ? document.getElementById(badgeId) : null;
  if (!accountEl) {
    accountEl = document.getElementById("profileAccount") || document.getElementById("account");
  }
  if (!badgeEl) {
    badgeEl = document.getElementById("addressHashBadge") || document.getElementById("indexAddressHashBadge") || document.getElementById("registerAddressHashBadge");
  }
  if (!accountEl || !connectedAccount) return;

  const isFull = accountEl.getAttribute("data-show-full") === "true";
  if (!isFull) {
    accountEl.setAttribute("data-show-full", "true");
    accountEl.textContent = connectedAccount;
    if (badgeEl) badgeEl.textContent = "FULL";
  } else {
    accountEl.setAttribute("data-show-full", "false");
    accountEl.textContent = typeof formatAddressHash === "function"
      ? formatAddressHash(connectedAccount)
      : (typeof shortenAddress === "function" ? shortenAddress(connectedAccount) : connectedAccount);
    if (badgeEl) badgeEl.textContent = "HASH";
  }
};

// Formats and synchronizes account hashes and copy buttons across the active page.
const updateGlobalAccountDisplays = () => {
  const accountElements = document.querySelectorAll("#account, #profileAccount");
  accountElements.forEach((el) => {
    if (connectedAccount) {
      const isFull = el.getAttribute("data-show-full") === "true";
      const displayHash = typeof formatAddressHash === "function"
        ? formatAddressHash(connectedAccount)
        : (typeof shortenAddress === "function" ? shortenAddress(connectedAccount) : connectedAccount);
      el.textContent = isFull ? connectedAccount : displayHash;
      el.setAttribute("data-full-address", connectedAccount);
      el.title = "Full address: " + connectedAccount + " (Click to toggle hash / full)";
      el.classList.add("is-connected");
    } else {
      el.textContent = "Wallet not connected";
      el.removeAttribute("data-full-address");
      el.title = "Please connect your MetaMask wallet";
      el.classList.remove("is-connected");
    }
  });

  // Enable / disable copy buttons
  const copyButtons = document.querySelectorAll("#copyAddressBtn, #copyAccountBtn");
  copyButtons.forEach((btn) => {
    btn.disabled = !connectedAccount;
    btn.title = connectedAccount ? "Copy full address (" + connectedAccount + ")" : "Connect wallet first to copy";
  });

  // Toggle HASH badges
  const badges = document.querySelectorAll("#addressHashBadge, #registerAddressHashBadge, #indexAddressHashBadge");
  badges.forEach((b) => {
    if (connectedAccount) {
      b.classList.remove("hidden");
    } else {
      b.classList.add("hidden");
    }
  });
};

// Saves the account on the page and connects Web3 to our contract.
const useWalletAccount = async (account) => {
  if (!account) return;
  localStorage.removeItem(WALLET_LOGOUT_FLAG);
  connectedAccount = account;
  web3Client = new Web3(window.ethereum);
  updateGlobalAccountDisplays();
  updateWalletHeader();
  await connectToContract();
  await refreshPageForRole();
};

// Asks MetaMask for the user's wallet and then connects it to the contract.
const connectWallet = async () => {
  if (typeof window.ethereum === "undefined") {
    showStatusMessage("MetaMask is not installed.", "error");
    return;
  }
  try {
    localStorage.removeItem(WALLET_LOGOUT_FLAG);
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    await useWalletAccount(accounts[0]);
    showStatusMessage("Connected to MetaMask.");
  } catch (error) {
    showFriendlyError(error, "Connecting your wallet");
  }
};

// Opens the registration page from other pages, but connects MetaMask on it.
const openRegisterOrConnect = async () => {
  if (document.body.dataset.page === "register") {
    await connectWallet();
    return;
  }

  window.location.href = "profile.html#account-role";
};

// Connects when logged out and clears only this dApp session when connected.
const handleWalletButtonClick = async () => {
  if (connectedAccount) {
    logoutWallet();
    return;
  }
  await connectWallet();
};

// Logs out of this dApp; MetaMask site permissions can still be removed inside MetaMask.
const logoutWallet = () => {
  localStorage.setItem(WALLET_LOGOUT_FLAG, "true");
  connectedAccount = undefined;
  web3Client = undefined;
  escrowContract = undefined;
  updateGlobalAccountDisplays();
  updateWalletHeader();
  if (typeof applyRoleLayout === "function") applyRoleLayout(0);
  window.location.href = "index.html";
};

// Restores an already-approved MetaMask account when the user opens another page.
// eth_accounts only checks the connection and does not open a wallet popup.
const restoreWalletConnection = async () => {
  if (typeof window.ethereum === "undefined") {
    updateGlobalAccountDisplays();
    return;
  }
  if (localStorage.getItem(WALLET_LOGOUT_FLAG) === "true") {
    updateGlobalAccountDisplays();
    updateWalletHeader();
    return;
  }
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (accounts.length > 0) {
    await useWalletAccount(accounts[0]);
  } else {
    updateGlobalAccountDisplays();
    updateWalletHeader();
  }
};

if (typeof window.ethereum !== "undefined") {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
