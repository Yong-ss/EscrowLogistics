// Shipper actions: create an agreement, fund it, verify milestones, refund.

// Collects the form and creates a new agreement on the blockchain.
const createNewAgreement = async () => {
  let createStep = "starting";
  try {
    createStep = "checking wallet connection";
    if (!connectedAccount || !escrowContract || !web3Client) {
      showStatusMessage("Connect your Shipper wallet before creating an agreement.", "error");
      return;
    }

    const carrierAddressInput = document.getElementById("carrierAddr").value.trim();
    const agreementNameInput = document.getElementById("agreementName").value.trim();
    const milestoneCount = Number(document.getElementById("milestoneCount").value);
    const payloadValueEther = document.getElementById("payloadValue").value.trim();
    const deadlineMinutes = Number(document.getElementById("deadlineMins").value);

    if (!agreementNameInput) {
      showStatusMessage("Please give this agreement a name.", "error");
      return;
    }
    if (!web3Client.utils.isAddress(carrierAddressInput)) {
      showStatusMessage("Please enter a valid Carrier wallet address starting with 0x.", "error");
      return;
    }
    if (carrierAddressInput.toLowerCase() === connectedAccount.toLowerCase()) {
      showStatusMessage("The Carrier wallet must be different from your Shipper wallet.", "error");
      return;
    }
    if (!Number.isInteger(milestoneCount) || milestoneCount < 1) {
      showStatusMessage("Milestone count must be a whole number greater than zero.", "error");
      return;
    }
    if (!payloadValueEther || !Number.isFinite(Number(payloadValueEther)) || Number(payloadValueEther) <= 0) {
      showStatusMessage("Total escrow amount must be greater than zero ETH.", "error");
      return;
    }
    if (!Number.isInteger(deadlineMinutes) || deadlineMinutes < 1) {
      showStatusMessage("Deadline must be at least 1 minute from now.", "error");
      return;
    }

    const payloadValueWei = web3Client.utils.toWei(payloadValueEther, "ether");
    const latestBlock = await web3Client.eth.getBlock("latest");
    const deadlineTimestamp = Number(latestBlock.timestamp) + deadlineMinutes * 60;
    const milestoneInputs = getMilestoneInputs();
    if (milestoneInputs.names.length !== milestoneCount) {
      showStatusMessage("The milestone fields do not match the milestone count.", "error");
      return;
    }
    const emptyNameIndex = milestoneInputs.names.findIndex((name) => !name);
    if (emptyNameIndex >= 0) {
      showStatusMessage("Please give Milestone " + (emptyNameIndex + 1) + " a name.", "error");
      return;
    }
    const invalidPercentage = milestoneInputs.payoutPercentages.some((percentage) =>
      !Number.isInteger(percentage) || percentage < 1 || percentage > 100
    );
    if (invalidPercentage) {
      showStatusMessage("Each milestone payout share must be a whole number from 1% to 100%.", "error");
      return;
    }
    if (milestoneInputs.payoutPercentages.reduce((sum, value) => sum + value, 0) !== 100) {
      showStatusMessage("Payout shares must add up to 100%.", "error");
      return;
    }

    createStep = "checking Carrier registration";
    const carrierRole = Number(await escrowContract.methods.roles(carrierAddressInput).call());
    if (carrierRole !== 2) {
      showStatusMessage("This wallet is not registered as a Carrier. Ask the Carrier to register first.", "error");
      return;
    }

    createStep = "checking the agreement with Ganache";
    const createCall = escrowContract.methods
      .createAgreement(
        carrierAddressInput,
        agreementNameInput,
        milestoneCount,
        payloadValueWei,
        deadlineTimestamp,
        milestoneInputs.names,
        milestoneInputs.descriptions,
        milestoneInputs.payoutPercentages
      );

    // Simulate the contract first, so a rejected form shows a clear message
    // without opening MetaMask or asking the user to confirm a doomed transaction.
    await createCall.call({ from: connectedAccount });
    showStatusMessage("Ready to create the agreement. Confirm the transaction in MetaMask.");
    createStep = "waiting for MetaMask confirmation";
    const result = await createCall.send({ from: connectedAccount });

    const createdEvent = result.events && result.events.AgreementCreated;
    const agreementId = createdEvent ? createdEvent.returnValues.id : "";
    showStatusMessage(agreementId
      ? "Agreement created successfully. Agreement #" + agreementId + " is waiting for Carrier acceptance."
      : "Agreement created successfully. It is waiting for Carrier acceptance.");
  } catch (error) {
    showFriendlyError(error, "Creating the agreement (" + createStep + ")");
  }
};

// Funds the selected agreement with the exact amount already declared on-chain.
const fundAgreementEscrow = async () => {
  try {
    const agreementId = document.getElementById("fundId").value;
    if (!agreementId) {
      showStatusMessage("Please choose an agreement to fund.", "error");
      return;
    }
    const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
    const fundAmountWei = agreementRecord.declaredPayloadValue;
    const fundAmountEther = web3Client.utils.fromWei(fundAmountWei, "ether");

    await escrowContract.methods.fund(agreementId).send({ from: connectedAccount, value: fundAmountWei });
    showStatusMessage("Funded agreement " + agreementId + " with " + fundAmountEther + " ETH.");
  } catch (error) {
    showFriendlyError(error, "Funding the agreement");
  }
};

// verify the next milestone (releases a payout share to the carrier)
// Approves the next milestone and reports the payment released to the Carrier.
const verifyNextMilestone = async () => {
  try {
    const agreementId = document.getElementById("verifyId").value;
    if (!agreementId) {
      showStatusMessage("Please choose an agreement to verify.", "error");
      return;
    }
    const result = await escrowContract.methods.verifyMilestone(agreementId).send({ from: connectedAccount });
    const milestoneEvent = result.events.MilestoneVerified.returnValues;
    const payoutEther = web3Client.utils.fromWei(milestoneEvent.payout, "ether");
    showStatusMessage("Milestone " + milestoneEvent.milestoneNo + " verified, paid " + payoutEther + " ETH to carrier.");
    await loadMilestoneForVerification();
  } catch (error) {
    showFriendlyError(error, "Verifying the milestone");
  }
};

// Reads all agreements created by the connected Shipper for the action pages.
const getAgreementsForCurrentShipper = async () => {
  const count = Number(await escrowContract.methods.agreementCount().call());
  const agreements = [];
  for (let id = 1; id <= count; id++) {
    const agreement = await escrowContract.methods.getAgreement(id).call();
    if (agreement.shipper.toLowerCase() === connectedAccount.toLowerCase()) agreements.push(agreement);
  }
  return agreements;
};

// Displays only this Shipper's accepted agreements that are ready for funding.
const loadFundableAgreements = async () => {
  try {
    const agreements = await getAgreementsForCurrentShipper();
    renderShipperChoices("fund", agreements.filter((agreement) => Number(agreement.status) === 0 && agreement.carrierAccepted));
  } catch (error) { showFriendlyError(error, "Loading funding options"); }
};

// Displays only funded agreements whose next milestone can be verified.
const loadVerifiableAgreements = async () => {
  try {
    const agreements = await getAgreementsForCurrentShipper();
    renderShipperChoices("verify", agreements.filter((agreement) => Number(agreement.status) === 1));
  } catch (error) { showFriendlyError(error, "Loading verification options"); }
};

// Displays funded agreements so the Shipper can choose a refund candidate by name.
const loadRefundableAgreements = async () => {
  try {
    const agreements = await getAgreementsForCurrentShipper();
    renderShipperChoices("refund", agreements.filter((agreement) => Number(agreement.status) === 1));
  } catch (error) { showFriendlyError(error, "Loading refund options"); }
};

// Renders reusable agreement cards and remembers the selected ID in a hidden input.
const renderShipperChoices = (action, agreements) => {
  const container = document.getElementById(action + "AgreementChoices");
  if (!container) return;
  if (!agreements.length) {
    container.innerHTML = "<p class='choice-empty'>No agreement is ready for this action yet.</p>";
    return;
  }
  container.innerHTML = agreements.map((agreement) =>
    "<button type='button' class='agreement-choice' onclick=\"chooseShipperAgreement('" + action + "','" + agreement.id + "')\"><span><strong>" + agreement.name + "</strong><small>Agreement #" + agreement.id + " · " + web3Client.utils.fromWei(agreement.declaredPayloadValue, "ether") + " ETH</small></span><span class='choice-arrow'>→</span></button>"
  ).join("");
  if (agreements.length === 1) chooseShipperAgreement(action, agreements[0].id);
};

// Selects an agreement and refreshes the helpful amount or milestone preview.
const chooseShipperAgreement = async (action, agreementId) => {
  const input = document.getElementById(action + "Id");
  const container = document.getElementById(action + "AgreementChoices");
  if (!input || !container) return;
  input.value = agreementId;
  container.querySelectorAll(".agreement-choice").forEach((choice) => choice.classList.toggle("selected", choice.querySelector("small").textContent.includes("#" + agreementId + " ·") || choice.querySelector("small").textContent === "Agreement #" + agreementId));
  if (action === "fund") {
    const agreement = await escrowContract.methods.getAgreement(agreementId).call();
    const summary = document.getElementById("fundSummary");
    if (summary) summary.innerHTML = "<b>Amount to lock:</b> " + web3Client.utils.fromWei(agreement.declaredPayloadValue, "ether") + " ETH<br><b>Payment is released:</b> after each milestone is verified.";
  }
  if (action === "verify") await loadMilestoneForVerification();
};

// Shows the current milestone and the Carrier's note before the Shipper verifies it.
const loadMilestoneForVerification = async () => {
  try {
    const agreementId = document.getElementById("verifyId").value;
    if (!agreementId) return;
    const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
    const currentIndex = Number(agreementRecord.milestonesDone);

    if (currentIndex >= Number(agreementRecord.milestoneCount)) {
      document.getElementById("verificationMilestone").innerHTML = "All milestones are already verified.";
      return;
    }

    const milestone = await escrowContract.methods.getMilestone(agreementId, currentIndex).call();
    const noteText = milestone.submitted
      ? milestone.submissionNote
      : "Waiting for the Carrier to submit a completion note.";

    document.getElementById("verificationMilestone").innerHTML =
      "<strong>Milestone " + (currentIndex + 1) + ": " + milestone.name + "</strong><br>" +
      "Description: " + milestone.description + "<br>" +
      "Payout: " + milestone.payoutPercentage + "% (" +
      web3Client.utils.fromWei(
        (BigInt(agreementRecord.declaredPayloadValue) * BigInt(milestone.payoutPercentage) / 100n).toString(),
        "ether"
      ) + " ETH)<br>" +
      "Carrier note: " + noteText;
  } catch (error) {
    showFriendlyError(error, "Loading the milestone");
  }
};

// trigger a refund after the deadline
// Requests the remaining escrow to be returned after the deadline.
const requestRefund = async () => {
  try {
    const agreementId = document.getElementById("refundId").value;
    if (!agreementId) {
      showStatusMessage("Please choose an agreement for the refund.", "error");
      return;
    }
    const result = await escrowContract.methods.refund(agreementId).send({ from: connectedAccount });
    const refundedEther = web3Client.utils.fromWei(result.events.Refunded.returnValues.amount, "ether");
    showStatusMessage("Refunded " + refundedEther + " ETH to shipper for agreement " + agreementId + ".");
  } catch (error) {
    showFriendlyError(error, "Requesting the refund");
  }
};
