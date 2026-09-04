// "Register" section - lets a new account pick a role (Shipper or Carrier).

// Sends the selected Shipper or Carrier role to the blockchain.
const registerAsRole = async (roleNumber) => {
  try {
    // A contract call only works after this browser has connected its MetaMask wallet.
    if (!connectedAccount || !escrowContract) {
      showStatusMessage("Please click Connect wallet first.", "error");
      return;
    }

    await escrowContract.methods.register(roleNumber).send({ from: connectedAccount });
    await refreshPageForRole();
    showStatusMessage("Registered as " + ROLE_NAMES[roleNumber] + ".");
  } catch (error) {
    showFriendlyError(error, "Registering this wallet");
  }
};
