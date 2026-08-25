// "Register" section - lets a new account pick a role (Shipper or Carrier).

const registerAsRole = async (roleNumber) => {
  try {
    await escrowContract.methods.register(roleNumber).send({ from: connectedAccount });
    await refreshPageForRole();
    showStatusMessage("Registered as " + ROLE_NAMES[roleNumber] + ".");
  } catch (error) {
    showStatusMessage("Register failed: " + (error.message || error));
  }
};
