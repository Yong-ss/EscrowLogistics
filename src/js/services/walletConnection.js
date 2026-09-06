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

// Updates the shared header so the wallet action is clear on every page.
const updateWalletHeader = () => {
  const button = document.getElementById("walletButton");
  const roleBadge = document.getElementById("roleBadge");
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

// Saves the account on the page and connects Web3 to our contract.
const useWalletAccount = async (account) => {
  if (!account) return;
  localStorage.removeItem(WALLET_LOGOUT_FLAG);
  connectedAccount = account;
  web3Client = new Web3(window.ethereum);
  const accountElement = document.getElementById("account");
  if (accountElement) accountElement.textContent = connectedAccount;
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

  window.location.href = "register.html";
};

// Connects when logged out and clears only this dApp session when connected.
const handleWalletButtonClick = async () => {
  if (connectedAccount) {
    logoutWallet();
    return;
  }
  await openRegisterOrConnect();
};

// Logs out of this dApp; MetaMask site permissions can still be removed inside MetaMask.
const logoutWallet = () => {
  localStorage.setItem(WALLET_LOGOUT_FLAG, "true");
  connectedAccount = undefined;
  web3Client = undefined;
  escrowContract = undefined;
  updateWalletHeader();
  if (typeof applyRoleLayout === "function") applyRoleLayout(0);
  window.location.href = "register.html";
};

// Restores an already-approved MetaMask account when the user opens another page.
// eth_accounts only checks the connection and does not open a wallet popup.
const restoreWalletConnection = async () => {
  if (typeof window.ethereum === "undefined") return;
  if (localStorage.getItem(WALLET_LOGOUT_FLAG) === "true") {
    updateWalletHeader();
    return;
  }
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (accounts.length > 0) await useWalletAccount(accounts[0]);
  else updateWalletHeader();
};

if (typeof window.ethereum !== "undefined") {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
