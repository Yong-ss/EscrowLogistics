// Shipper actions: create an agreement, fund it, verify milestones, refund.

// Collects the form and creates a new agreement on the blockchain.
const createNewAgreement = async () => {
  try {
    const carrierAddressInput = document.getElementById("carrierAddr").value;
    const agreementNameInput = document.getElementById("agreementName").value.trim();
    const milestoneCountInput = document.getElementById("milestoneCount").value;
    const payloadValueEther = document.getElementById("payloadValue").value;
    const payloadValueWei = web3Client.utils.toWei(payloadValueEther, "ether");
    const deadlineMinutesInput = parseInt(document.getElementById("deadlineMins").value, 10);
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadlineMinutesInput * 60;
    const milestoneInputs = getMilestoneInputs();
    if (milestoneInputs.payoutPercentages.reduce((sum, value) => sum + value, 0) !== 100) {
      showStatusMessage("Payout shares must add up to 100%.", "error");
      return;
    }

    const result = await escrowContract.methods
      .createAgreement(
        carrierAddressInput,
        agreementNameInput,
        milestoneCountInput,
        payloadValueWei,
        deadlineTimestamp,
        milestoneInputs.names,
        milestoneInputs.descriptions,
        milestoneInputs.payoutPercentages
      )
      .send({ from: connectedAccount });

    const agreementId = result.events.AgreementCreated.returnValues.id;
    showStatusMessage("Agreement created with ID " + agreementId + ".");
  } catch (error) {
    showFriendlyError(error, "Creating the agreement");
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

// Displays only this Shipper's accepted agreements that are ready for funding.
const loadFundableAgreements = async () => {
  try {
    const count = Number(await escrowContract.methods.agreementCount().call());
    const agreements = [];
    for (let id = 1; id <= count; id++) {
      const agreement = await escrowContract.methods.getAgreement(id).call();
      if (agreement.shipper.toLowerCase() === connectedAccount.toLowerCase() &&
          Number(agreement.status) === 0 && agreement.carrierAccepted) agreements.push(agreement);
    }
    renderShipperChoices("fund", agreements);
  } catch (error) { showFriendlyError(error, "Loading funding options"); }
};

// Displays only funded agreements whose next milestone can be verified.
const loadVerifiableAgreements = async () => {
  try {
    const count = Number(await escrowContract.methods.agreementCount().call());
    const agreements = [];
    for (let id = 1; id <= count; id++) {
      const agreement = await escrowContract.methods.getAgreement(id).call();
      if (agreement.shipper.toLowerCase() === connectedAccount.toLowerCase() && Number(agreement.status) === 1) agreements.push(agreement);
    }
    renderShipperChoices("verify", agreements);
  } catch (error) { showFriendlyError(error, "Loading verification options"); }
};

// Displays funded agreements so the Shipper can choose a refund candidate by name.
const loadRefundableAgreements = async () => {
  try {
    const count = Number(await escrowContract.methods.agreementCount().call());
    const agreements = [];
    for (let id = 1; id <= count; id++) {
      const agreement = await escrowContract.methods.getAgreement(id).call();
      if (agreement.shipper.toLowerCase() === connectedAccount.toLowerCase() && Number(agreement.status) === 1) agreements.push(agreement);
    }
    renderShipperChoices("refund", agreements);
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
