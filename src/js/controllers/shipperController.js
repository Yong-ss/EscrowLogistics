// Shipper actions: create an agreement, fund it, verify milestones, refund.

// Collects the form and creates a new agreement on the blockchain.
const createNewAgreement = async () => {
  let createStep = "starting";
  try {
    createStep = "checking wallet connection";
    if (!connectedAccount || !escrowContract || !web3Client) {
      showStatusMessage("Connect your Shipper wallet before creating an agreement.", "warning");
      return;
    }

    const carrierAddressInput = document.getElementById("carrierAddr").value.trim();
    const agreementNameInput = document.getElementById("agreementName").value.trim();
    const milestoneCount = Number(document.getElementById("milestoneCount").value);
    const payloadValueEther = document.getElementById("payloadValue").value.trim();
    const deadlineMinutes = Number(document.getElementById("deadlineMins").value);

    if (!agreementNameInput) {
      showStatusMessage("Please give this agreement a name.", "required");
      return;
    }
    if (!web3Client.utils.isAddress(carrierAddressInput)) {
      showStatusMessage("Please enter a valid Carrier wallet address starting with 0x.", "required");
      return;
    }
    if (carrierAddressInput.toLowerCase() === connectedAccount.toLowerCase()) {
      showStatusMessage("The Carrier wallet must be different from your Shipper wallet.", "warning");
      return;
    }
    if (!Number.isInteger(milestoneCount) || milestoneCount < 1) {
      showStatusMessage("Milestone count must be a whole number greater than zero.", "required");
      return;
    }
    if (!payloadValueEther || !Number.isFinite(Number(payloadValueEther)) || Number(payloadValueEther) <= 0) {
      showStatusMessage("Total escrow amount must be greater than zero ETH.", "required");
      return;
    }
    if (!Number.isInteger(deadlineMinutes) || deadlineMinutes < 1) {
      showStatusMessage("Deadline must be at least 1 minute from now.", "required");
      return;
    }

    const payloadValueWei = web3Client.utils.toWei(payloadValueEther, "ether");
    const latestBlock = await web3Client.eth.getBlock("latest");
    const deadlineTimestamp = Number(latestBlock.timestamp) + deadlineMinutes * 60;
    const milestoneInputs = getMilestoneInputs();
    if (milestoneInputs.names.length !== milestoneCount) {
      showStatusMessage("The milestone fields do not match the milestone count.", "warning");
      return;
    }
    const emptyNameIndex = milestoneInputs.names.findIndex((name) => !name);
    if (emptyNameIndex >= 0) {
      showStatusMessage("Please give Milestone " + (emptyNameIndex + 1) + " a name.", "required");
      return;
    }
    const invalidPercentage = milestoneInputs.payoutPercentages.some((percentage) =>
      !Number.isInteger(percentage) || percentage < 1 || percentage > 100
    );
    if (invalidPercentage) {
      showStatusMessage("Each milestone payout share must be a whole number from 1% to 100%.", "warning");
      return;
    }
    if (milestoneInputs.payoutPercentages.reduce((sum, value) => sum + value, 0) !== 100) {
      showStatusMessage("Payout shares must add up to 100%.", "warning");
      return;
    }

    createStep = "checking Carrier registration";
    const carrierRole = Number(await escrowContract.methods.roles(carrierAddressInput).call());
    if (carrierRole !== 2) {
      showStatusMessage("This wallet is not registered as a Carrier. Ask the Carrier to register first.", "warning");
      return;
    }

    createStep = "checking the agreement on the blockchain";
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
    showStatusMessage("Ready to create the agreement. Confirm the transaction in MetaMask.", "info");
    createStep = "waiting for MetaMask confirmation";
    const result = await sendWithEstimatedGas(createCall, { from: connectedAccount });

    const createdValues = getEventReturnValues(result, "AgreementCreated");
    const agreementId = createdValues ? createdValues.id : "";
    showStatusMessage(agreementId
      ? "Agreement created successfully. Agreement #" + agreementId + " is waiting for Carrier acceptance."
      : "Agreement created successfully. It is waiting for Carrier acceptance.", "success");
  } catch (error) {
    showFriendlyError(error, "Creating the agreement (" + createStep + ")");
  }
};

// Funds the selected agreement with the exact amount already declared on-chain.
const fundAgreementEscrow = async () => {
  try {
    const agreementId = document.getElementById("fundId").value;
    if (!agreementId) {
      showStatusMessage("Please choose an agreement to fund.", "required");
      return;
    }
    const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
    const fundAmountWei = agreementRecord.declaredPayloadValue;
    const fundAmountEther = web3Client.utils.fromWei(fundAmountWei, "ether");

    await sendWithEstimatedGas(
      escrowContract.methods.fund(agreementId),
      { from: connectedAccount, value: fundAmountWei }
    );
    showStatusMessage("Funded agreement " + agreementId + " with " + fundAmountEther + " ETH.", "success");
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
      showStatusMessage("Please choose an agreement to verify.", "required");
      return;
    }
    const result = await sendWithEstimatedGas(
      escrowContract.methods.verifyMilestone(agreementId),
      { from: connectedAccount }
    );
    const milestoneValues = getEventReturnValues(result, "MilestoneVerified");
    if (milestoneValues) {
      const payoutEther = web3Client.utils.fromWei(milestoneValues.payout, "ether");
      showStatusMessage("Milestone " + milestoneValues.milestoneNo + " verified, paid " + payoutEther + " ETH to carrier.", "success");
    } else {
      showStatusMessage("Milestone verified and payment released to the Carrier.", "success");
    }
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
    if (action === "verify") {
      const tracker = document.getElementById("shipperMilestoneTracker");
      if (tracker) tracker.innerHTML = "";
      const actionWrap = document.getElementById("verifyActionContainer");
      if (actionWrap) actionWrap.classList.add("hidden");
    }
    return;
  }
  container.innerHTML = agreements.map((agreement) =>
    "<button type='button' class='agreement-choice' onclick=\"chooseShipperAgreement('" + action + "','" + agreement.id + "')\"><span><strong>" + (typeof escapeHtmlForPage === 'function' ? escapeHtmlForPage(agreement.name) : agreement.name) + "</strong><small>Agreement #" + agreement.id + " · " + web3Client.utils.fromWei(agreement.declaredPayloadValue, "ether") + " ETH</small></span><span class='choice-arrow'>→</span></button>"
  ).join("");
  if (agreements.length === 1) chooseShipperAgreement(action, agreements[0].id);
};

// Selects an agreement and refreshes the helpful amount or milestone preview.
const chooseShipperAgreement = async (action, agreementId) => {
  try {
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
  } catch (error) {
    showFriendlyError(error, "Loading the selected agreement");
  }
};

// Shows the milestone step progression and Carrier's note before the Shipper verifies it.
const loadMilestoneForVerification = async () => {
  try {
    const agreementId = document.getElementById("verifyId").value;
    const trackerContainer = document.getElementById("shipperMilestoneTracker");
    const actionContainer = document.getElementById("verifyActionContainer");
    const verifyBtn = document.getElementById("verifyReleaseBtn");
    if (!agreementId || !trackerContainer) return;

    const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
    const milestoneCount = Number(agreementRecord.milestoneCount);
    const currentIndex = Number(agreementRecord.milestonesDone);

    // Fetch all milestones for this agreement
    const milestones = [];
    for (let i = 0; i < milestoneCount; i++) {
      const m = await escrowContract.methods.getMilestone(agreementId, i).call();
      milestones.push(m);
    }

    // Render interactive animated stepper
    renderMilestoneStepTracker(trackerContainer, agreementRecord, milestones, { role: "shipper" });

    // Manage verification button state
    if (actionContainer) {
      if (currentIndex >= milestoneCount) {
        actionContainer.classList.add("hidden");
      } else {
        actionContainer.classList.remove("hidden");
        const activeMilestone = milestones[currentIndex];
        if (verifyBtn) {
          if (activeMilestone && activeMilestone.submitted) {
            verifyBtn.disabled = false;
            verifyBtn.textContent = "Verify milestone #" + (currentIndex + 1) + " & release payment →";
          } else {
            verifyBtn.disabled = true;
            verifyBtn.textContent = "Awaiting Carrier completion note...";
          }
        }
      }
    }
  } catch (error) {
    showFriendlyError(error, "Loading the milestone progression");
  }
};

// trigger a refund after the deadline
// Requests the remaining escrow to be returned after the deadline.
const requestRefund = async () => {
  try {
    const agreementId = document.getElementById("refundId").value;
    if (!agreementId) {
      showStatusMessage("Please choose an agreement for the refund.", "required");
      return;
    }
    const result = await sendWithEstimatedGas(
      escrowContract.methods.refund(agreementId),
      { from: connectedAccount }
    );
    const refundedValues = getEventReturnValues(result, "Refunded");
    if (refundedValues) {
      const refundedEther = web3Client.utils.fromWei(refundedValues.amount, "ether");
      showStatusMessage("Refunded " + refundedEther + " ETH to shipper for agreement " + agreementId + ".", "success");
    } else {
      showStatusMessage("Refund completed for agreement " + agreementId + ".", "success");
    }
  } catch (error) {
    showFriendlyError(error, "Requesting the refund");
  }
};
