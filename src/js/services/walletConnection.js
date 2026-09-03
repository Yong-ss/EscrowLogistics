// Connects MetaMask and exposes the connected account + web3 client
// to every other file (plain <script> tags share one global scope).

let connectedAccount;   // the address of the currently connected MetaMask account
let web3Client;         // the web3.js instance built from window.ethereum

const connectWallet = async () => {
  if (typeof window.ethereum === "undefined") {
    showStatusMessage("MetaMask is not installed.");
    return;
  }
  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  connectedAccount = accounts[0];
  web3Client = new Web3(window.ethereum);
  document.getElementById("account").innerHTML = connectedAccount;
  await connectToContract();
  await refreshPageForRole();
  showStatusMessage("Connected to MetaMask.");
};

if (typeof window.ethereum !== "undefined") {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
