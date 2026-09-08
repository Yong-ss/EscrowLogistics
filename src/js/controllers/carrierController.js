// Carrier dashboard: reputation points + the list of jobs assigned to this account.

// Loads the Carrier's reputation and then refreshes the assigned jobs.
const loadCarrierDashboard = async () => {
  const reputationPoints = await escrowContract.methods.reputation(connectedAccount).call();
  document.getElementById("repPoints").innerHTML = reputationPoints;
  await loadCarrierJobs();
};

// list every agreement where the connected account is the carrier
// Finds every agreement assigned to the connected Carrier wallet.
const loadCarrierJobs = async () => {
  try {
    const totalAgreementCount = Number(await escrowContract.methods.agreementCount().call());
    const jobRows = [];
    const carrierAgreements = [];

    for (let agreementId = 1; agreementId <= totalAgreementCount; agreementId++) {
      const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
      if (agreementRecord.carrier.toLowerCase() !== connectedAccount.toLowerCase()) continue;
      carrierAgreements.push(agreementRecord);

      const totalEth = web3Client.utils.fromWei(agreementRecord.totalValue, "ether");
      const receivedEth = web3Client.utils.fromWei(agreementRecord.amountReleased, "ether");
      const acceptanceBadge = agreementRecord.carrierAccepted
        ? "<span class='status-pill status-completed'>Accepted</span>"
        : "<span class='status-pill status-refunded'>Waiting acceptance</span>";

      jobRows.push(
        "<tr><td><strong>#" + agreementRecord.id + "</strong></td>" +
        "<td><strong>" + (typeof escapeHtmlForPage === 'function' ? escapeHtmlForPage(agreementRecord.name) : agreementRecord.name) + "</strong></td>" +
        "<td><span class='detail-address-row'><code class='address-code' title='" + escapeHtmlForPage(agreementRecord.shipper) + "'>" + shortenAddress(agreementRecord.shipper) + "</code><button type='button' class='button-mini-copy' onclick=\"copyTextToClipboard('" + escapeHtmlForPage(agreementRecord.shipper) + "', 'Shipper address', this)\" title='Copy full Shipper address'>📋 Copy</button></span></td>" +
        "<td>" + totalEth + " ETH</td>" +
        "<td>" + agreementRecord.milestonesDone + " / " + agreementRecord.milestoneCount + "</td>" +
        "<td>" + receivedEth + " ETH</td>" +
        "<td>" + acceptanceBadge + "</td></tr>"
      );
    }

    document.querySelector("#jobsTable tbody").innerHTML =
      jobRows.length ? jobRows.join("") : "<tr><td colspan='7'>No jobs assigned to you yet.</td></tr>";
    updateCarrierAgreementOptions(carrierAgreements);
    showStatusMessage("Loaded " + jobRows.length + " job(s).", "info");
  } catch (error) {
    showFriendlyError(error, "Loading your jobs");
  }
};

// Fills simple dropdowns so the Carrier can choose a job by name instead of typing its ID.
const updateCarrierAgreementOptions = (agreements) => {
  const acceptChoices = document.getElementById("acceptAgreementChoices");
  const submitChoices = document.getElementById("submitAgreementChoices");
  if (!acceptChoices || !submitChoices) return;

  const pendingAgreements = agreements.filter(
    (agreement) => Number(agreement.status) === 0 && !agreement.carrierAccepted
  );
  const fundedAgreements = agreements.filter(
    (agreement) => agreement.carrierAccepted && Number(agreement.status) === 1
  );

  renderAgreementChoices("accept", pendingAgreements, acceptChoices);
  renderAgreementChoices("submit", fundedAgreements, submitChoices);
};

// Shows clean clickable agreement cards instead of the browser's hard-to-style dropdown.
const renderAgreementChoices = (action, agreements, container) => {
  if (!agreements.length) {
    container.innerHTML = action === "accept"
      ? "<p class='choice-empty'>No agreement waiting for acceptance.</p>"
      : "<p class='choice-empty'>No funded agreement available yet.</p>";
    if (action === "submit") {
      const tracker = document.getElementById("carrierMilestoneTracker");
      if (tracker) tracker.innerHTML = "";
      const form = document.getElementById("milestoneSubmitForm");
      if (form) form.classList.add("hidden");
    }
    return;
  }

  container.innerHTML = agreements.map((agreement) =>
    "<button type='button' class='agreement-choice' onclick=\"chooseCarrierAgreement('" + action + "', '" + agreement.id + "')\">" +
    "<span><strong>" + (typeof escapeHtmlForPage === 'function' ? escapeHtmlForPage(agreement.name) : agreement.name) + "</strong><small>Agreement #" + agreement.id + "</small></span>" +
    "<span class='choice-arrow'>→</span></button>"
  ).join("");

  // When there is only one possible job, select it automatically for convenience.
  if (agreements.length === 1) chooseCarrierAgreement(action, agreements[0].id);
};

// Stores the chosen ID and highlights the agreement card the Carrier clicked.
const chooseCarrierAgreement = (action, agreementId) => {
  const input = document.getElementById(action === "accept" ? "acceptAgreementId" : "submitAgreementId");
  const container = document.getElementById(action + "AgreementChoices");
  input.value = agreementId;
  container.querySelectorAll(".agreement-choice").forEach((choice) => {
    choice.classList.toggle("selected", choice.querySelector("small").textContent === "Agreement #" + agreementId);
  });

  if (action === "submit") loadCurrentMilestone();
};

// Accepts a Shipper's assignment so the escrow can be funded.
const acceptCarrierAgreement = async () => {
  try {
    const agreementId = document.getElementById("acceptAgreementId").value;
    if (!agreementId) {
      showStatusMessage("Please select an agreement to accept.", "required");
      return;
    }
    await sendWithEstimatedGas(
      escrowContract.methods.acceptAgreement(agreementId),
      { from: connectedAccount }
    );
    showStatusMessage("Agreement " + agreementId + " accepted.", "success");
    await loadCarrierJobs();
  } catch (error) {
    showFriendlyError(error, "Accepting the agreement");
  }
};

// Shows the milestone step progression so the Carrier knows exactly what to report.
const loadCurrentMilestone = async () => {
  try {
    const agreementId = document.getElementById("submitAgreementId").value;
    const trackerContainer = document.getElementById("carrierMilestoneTracker");
    const submitForm = document.getElementById("milestoneSubmitForm");
    const submitBtn = document.getElementById("submitMilestoneBtn");
    if (!agreementId || !trackerContainer) return;

    const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
    const milestoneCount = Number(agreementRecord.milestoneCount);
    const currentIndex = Number(agreementRecord.milestonesDone);

    // Fetch all milestones for this agreement to show the full journey
    const milestones = [];
    for (let i = 0; i < milestoneCount; i++) {
      const m = await escrowContract.methods.getMilestone(agreementId, i).call();
      milestones.push(m);
    }

    // Render interactive animated stepper
    renderMilestoneStepTracker(trackerContainer, agreementRecord, milestones, { role: "carrier" });

    // Manage completion note form visibility and button state
    if (submitForm) {
      if (currentIndex >= milestoneCount) {
        submitForm.classList.add("hidden");
      } else {
        submitForm.classList.remove("hidden");
        const activeMilestone = milestones[currentIndex];
        if (activeMilestone && activeMilestone.submitted) {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Milestone already submitted (Under Shipper Review)";
          }
        } else {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit milestone #" + (currentIndex + 1) + " for review →";
          }
        }
      }
    }
  } catch (error) {
    showFriendlyError(error, "Loading the milestone progression");
  }
};

// Sends the Carrier's short update to the blockchain for Shipper review.
const submitCurrentMilestone = async () => {
  try {
    const agreementId = document.getElementById("submitAgreementId").value;
    const note = document.getElementById("completionNote").value.trim();

    if (!note) {
      showStatusMessage("Please write a completion note first.", "required");
      return;
    }

    await sendWithEstimatedGas(
      escrowContract.methods.submitMilestone(agreementId, note),
      { from: connectedAccount }
    );

    document.getElementById("completionNote").value = "";
    showStatusMessage("Milestone submitted for Shipper review.", "success");
    await loadCurrentMilestone();
  } catch (error) {
    showFriendlyError(error, "Submitting the milestone");
  }
};
