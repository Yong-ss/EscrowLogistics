// Connects MetaMask and exposes the connected account + web3 client
// to every other file (plain <script> tags share one global scope).

let connectedAccount;   // the address of the currently connected MetaMask account
let web3Client;         // the web3.js instance built from window.ethereum

// Saves the account on the page and connects Web3 to our contract.
const useWalletAccount = async (account) => {
  connectedAccount = account;
  web3Client = new Web3(window.ethereum);
  const accountElement = document.getElementById("account");
  if (accountElement) accountElement.innerHTML = connectedAccount;
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
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
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

// Restores an already-approved MetaMask account when the user opens another page.
// eth_accounts only checks the connection and does not open a wallet popup.
const restoreWalletConnection = async () => {
  if (typeof window.ethereum === "undefined") return;
  const accounts = await ethereum.request({ method: "eth_accounts" });
  if (accounts.length > 0) await useWalletAccount(accounts[0]);
};

if (typeof window.ethereum !== "undefined") {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
