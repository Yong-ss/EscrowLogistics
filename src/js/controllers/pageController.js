// Decides which section of the page to show, based on the connected account's role.

// Reads the wallet role and shows only the pages that role can use.
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
  hidePanel("agreementDetailsSection");
  hidePanel("agreementHistorySection");

  if (currentUserRole === 1) {
    // Shipper: operations + shared panels
    showPanel("shipperView");
    showPanel("detailsSection");
    showPanel("historySection");
    showPanel("agreementDetailsSection");
    showPanel("agreementHistorySection");
  } else if (currentUserRole === 2) {
    // Carrier: dashboard + shared panels (no operation buttons)
    showPanel("carrierView");
    showPanel("detailsSection");
    showPanel("historySection");
    showPanel("agreementDetailsSection");
    showPanel("agreementHistorySection");
    if (document.body.dataset.page === "jobs" && typeof loadCarrierDashboard === "function") {
      await loadCarrierDashboard();
    }
  } else {
    // not registered yet
    showPanel("registerSection");
  }

  // Agreements page gets a wallet-specific list instead of making users guess IDs.
  if (document.body.dataset.page === "agreements" && typeof loadMyAgreements === "function") {
    await loadMyAgreements();
  }
  if (document.body.dataset.page === "agreement-details" && typeof loadSelectedAgreementDetails === "function") {
    await loadSelectedAgreementDetails();
  }
  if (currentUserRole === 1 && document.body.dataset.page === "fund" && typeof loadFundableAgreements === "function") await loadFundableAgreements();
  if (currentUserRole === 1 && document.body.dataset.page === "verify" && typeof loadVerifiableAgreements === "function") await loadVerifiableAgreements();
  if (currentUserRole === 1 && document.body.dataset.page === "refund" && typeof loadRefundableAgreements === "function") await loadRefundableAgreements();
};
