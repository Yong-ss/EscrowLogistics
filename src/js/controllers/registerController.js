// "Register" section - lets a new account pick a role (Shipper or Carrier).

// Shows either the role choices or the already-registered state on the account page.
const updateRegistrationView = (roleNumber) => {
  const choices = document.getElementById("registerChoices");
  const registered = document.getElementById("registeredState");
  const registeredRole = document.getElementById("registeredRole");
  if (!choices || !registered) return;

  const isRegistered = roleNumber === 1 || roleNumber === 2;
  choices.classList.toggle("hidden", isRegistered);
  registered.classList.toggle("hidden", !isRegistered);
  choices.querySelectorAll("button").forEach((button) => {
    button.disabled = !connectedAccount || isRegistered;
  });
  if (registeredRole && isRegistered) {
    registeredRole.textContent = ROLE_NAMES[roleNumber] + " account";
  }
};

// Sends the selected Shipper or Carrier role to the blockchain.
const registerAsRole = async (roleNumber) => {
  try {
    // A contract call only works after this browser has connected its MetaMask wallet.
    if (!connectedAccount || !escrowContract) {
      showStatusMessage("Please click Connect wallet first.", "error");
      return;
    }

    await sendWithEstimatedGas(
      escrowContract.methods.register(roleNumber),
      { from: connectedAccount }
    );
    await refreshPageForRole();
    showStatusMessage("Registered as " + ROLE_NAMES[roleNumber] + ".");
  } catch (error) {
    showFriendlyError(error, "Registering this wallet");
  }
};
