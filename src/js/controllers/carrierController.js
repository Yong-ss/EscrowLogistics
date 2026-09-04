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

      jobRows.push(
        "<tr><td>" + agreementRecord.id + "</td>" +
        "<td>" + agreementRecord.name + "</td>" +
        "<td>" + shortenAddress(agreementRecord.shipper) + "</td>" +
        "<td>" + web3Client.utils.fromWei(agreementRecord.totalValue, "ether") + "</td>" +
        "<td>" + agreementRecord.milestonesDone + " / " + agreementRecord.milestoneCount + "</td>" +
        "<td>" + web3Client.utils.fromWei(agreementRecord.amountReleased, "ether") + "</td>" +
        "<td>" + (agreementRecord.carrierAccepted ? "Accepted" : "Waiting for acceptance") + "</td></tr>"
      );
    }

    document.querySelector("#jobsTable tbody").innerHTML =
      jobRows.length ? jobRows.join("") : "<tr><td colspan='7'>No jobs assigned to you yet.</td></tr>";
    updateCarrierAgreementOptions(carrierAgreements);
    showStatusMessage("Loaded " + jobRows.length + " job(s).");
  } catch (error) {
    showFriendlyError(error, "Loading your jobs");
  }
};

// Fills simple dropdowns so the Carrier can choose a job by name instead of typing its ID.
const updateCarrierAgreementOptions = (agreements) => {
  const acceptChoices = document.getElementById("acceptAgreementChoices");
  const submitChoices = document.getElementById("submitAgreementChoices");
  if (!acceptChoices || !submitChoices) return;

  const pendingAgreements = agreements.filter((agreement) => !agreement.carrierAccepted);
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
    return;
  }

  container.innerHTML = agreements.map((agreement) =>
    "<button type='button' class='agreement-choice' onclick=\"chooseCarrierAgreement('" + action + "', '" + agreement.id + "')\">" +
    "<span><strong>" + agreement.name + "</strong><small>Agreement #" + agreement.id + "</small></span>" +
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
    await escrowContract.methods.acceptAgreement(agreementId).send({ from: connectedAccount });
    showStatusMessage("Agreement " + agreementId + " accepted.");
    await loadCarrierJobs();
  } catch (error) {
    showFriendlyError(error, "Accepting the agreement");
  }
};

// Shows the next milestone so the Carrier knows exactly what to report.
const loadCurrentMilestone = async () => {
  try {
    const agreementId = document.getElementById("submitAgreementId").value;
    const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
    const currentIndex = Number(agreementRecord.milestonesDone);

    if (currentIndex >= Number(agreementRecord.milestoneCount)) {
      document.getElementById("currentMilestone").innerHTML = "All milestones are already verified.";
      return;
    }

    const milestone = await escrowContract.methods.getMilestone(agreementId, currentIndex).call();
    const noteText = milestone.submitted
      ? "Carrier note: " + milestone.submissionNote
      : "Waiting for your completion note.";

    document.getElementById("currentMilestone").innerHTML =
      "<strong>Milestone " + (currentIndex + 1) + ": " + milestone.name + "</strong><br>" +
      milestone.description + "<br>" + noteText;
  } catch (error) {
    showFriendlyError(error, "Loading the milestone");
  }
};

// Sends the Carrier's short update to the blockchain for Shipper review.
const submitCurrentMilestone = async () => {
  try {
    const agreementId = document.getElementById("submitAgreementId").value;
    const note = document.getElementById("completionNote").value.trim();

    if (!note) {
      showStatusMessage("Please write a completion note first.", "error");
      return;
    }

    await escrowContract.methods
      .submitMilestone(agreementId, note)
      .send({ from: connectedAccount });

    document.getElementById("completionNote").value = "";
    showStatusMessage("Milestone submitted for Shipper review.");
    await loadCurrentMilestone();
  } catch (error) {
    showFriendlyError(error, "Submitting the milestone");
  }
};
