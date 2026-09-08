// Builds the contract instance used to read/write EscrowLogistics.sol.

let escrowContract;   // the web3 contract instance, built from abi.js
let activeEventSubscription = null;

// Sets up live listeners for on-chain events so pages update automatically without manual reload.
const setupContractEventListeners = () => {
  if (!escrowContract || activeEventSubscription) return;

  try {
    activeEventSubscription = escrowContract.events.allEvents()
      .on("data", async (eventRecord) => {
        console.log("Real-time event received:", eventRecord.event, eventRecord.returnValues);
        handleIncomingContractEvent(eventRecord);
      })
      .on("error", (error) => {
        console.warn("Event subscription warning:", error);
      });
  } catch (error) {
    console.warn("Real-time events not supported by this provider:", error);
  }
};

// Dispatches real-time event updates to the active view.
const handleIncomingContractEvent = async (eventRecord) => {
  if (typeof formatHistoryEvent === "function") {
    const formatted = formatHistoryEvent(eventRecord);
    if (formatted && formatted.detail) {
      showStatusMessage("🔔 " + formatted.detail, "success");
    }
  }

  const page = document.body.dataset.page;
  if (page === "agreements" && typeof loadMyAgreements === "function") {
    await loadMyAgreements();
  } else if (page === "agreement-details" && typeof loadSelectedAgreementDetails === "function") {
    await loadSelectedAgreementDetails();
  } else if (page === "jobs" && typeof loadCarrierDashboard === "function") {
    await loadCarrierDashboard();
  } else if (page === "fund" && typeof loadFundableAgreements === "function") {
    await loadFundableAgreements();
  } else if (page === "verify" && typeof loadVerifiableAgreements === "function") {
    await loadVerifiableAgreements();
  } else if (page === "refund" && typeof loadRefundableAgreements === "function") {
    await loadRefundableAgreements();
  }
};

// Creates the Web3 object that lets the page call EscrowLogistics.sol.
const connectToContract = async () => {
  escrowContract = new web3Client.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

  // Check the address before reading data, so a wrong MetaMask network gets a clear message.
  const contractCode = await web3Client.eth.getCode(CONTRACT_ADDRESS);
  if (!contractCode || /^0x0*$/.test(contractCode)) {
    throw new Error("Escrow contract is not deployed on this network");
  }

  setupContractEventListeners();
};
