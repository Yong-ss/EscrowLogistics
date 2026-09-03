// Decides which section of the page to show, based on the connected account's role.

const refreshPageForRole = async () => {
  if (!escrowContract || !connectedAccount) return;
  const currentUserRole = Number(await escrowContract.methods.roles(connectedAccount).call());

  // role badge in the header
  const roleBadge = document.getElementById("roleBadge");
  if (roleBadge) {
    roleBadge.innerHTML = ROLE_NAMES[currentUserRole];
    roleBadge.classList.remove("hidden");
  }

  if (typeof applyRoleLayout === "function") applyRoleLayout(currentUserRole);

  // start from a clean slate, then reveal what fits the role
  hidePanel("registerSection");
  hidePanel("shipperView");
  hidePanel("carrierView");
  hidePanel("detailsSection");
  hidePanel("historySection");

  if (currentUserRole === 1) {
    // Shipper: operations + shared panels
    showPanel("shipperView");
    showPanel("detailsSection");
    showPanel("historySection");
  } else if (currentUserRole === 2) {
    // Carrier: dashboard + shared panels (no operation buttons)
    showPanel("carrierView");
    showPanel("detailsSection");
    showPanel("historySection");
    if (typeof loadCarrierDashboard === "function") await loadCarrierDashboard();
  } else {
    // not registered yet
    showPanel("registerSection");
  }
};
