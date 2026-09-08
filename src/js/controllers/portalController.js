// Role choices unlock only after the connected network's contract is readable.
const refreshPageForRole = async () => {
  const role = Number(await escrowContract.methods.roles(connectedAccount).call());
  updateRegistrationView(role);
  document.getElementById('portalWalletHelp').textContent = 'Wallet connected. Your role is checked on the current network.';
  document.getElementById('portalConnect').textContent = 'Reconnect wallet';
};
const portalConnectButton = document.getElementById('portalConnect');
const portalStatus = document.getElementById('portalStatus');
const connectPortalWallet = async (restore = false) => {
  if (!window.ethereum) {
    portalStatus.textContent = 'MetaMask is not available in this browser. Open this page in a browser with MetaMask installed, then select Connect MetaMask.';
    return;
  }
  portalConnectButton.disabled = true;
  portalStatus.textContent = restore ? 'Checking your wallet…' : 'Approve the connection in MetaMask…';
  try {
    if (restore && localStorage.getItem(WALLET_LOGOUT_FLAG) === 'true') {
      portalStatus.textContent = 'Connect your wallet to continue.';
      return;
    }
    const accounts = await window.ethereum.request({ method: restore ? 'eth_accounts' : 'eth_requestAccounts' });
    if (!accounts.length) {
      portalStatus.textContent = 'Connect and select an account in MetaMask to continue.';
      return;
    }
    await useWalletAccount(accounts[0]);
    portalStatus.textContent = 'Connected. Choose your role or enter your existing workspace below.';
  } catch (error) {
    document.querySelectorAll('#registerChoices button').forEach((button) => { button.disabled = true; });
    document.getElementById('registeredState').classList.add('hidden');
    portalStatus.textContent = error.code === 4001 ? 'Connection cancelled. You can try again whenever you are ready.'
      : error.code === -32002 ? 'A request is already waiting in MetaMask. Open your wallet to approve it.'
      : 'Could not load your workspace. Check MetaMask is on the network where your escrow contract is deployed, then reconnect.';
    console.warn('Portal connection failed:', error);
  } finally {
    portalConnectButton.disabled = false;
  }
};
portalConnectButton.addEventListener('click', () => connectPortalWallet());
connectPortalWallet(true);
