// Shared views (both roles): agreement details lookup + event history table.

// Lists agreements connected to this wallet so users can choose by name.
const loadMyAgreements = async () => {
  try {
    const totalAgreementCount = Number(await escrowContract.methods.agreementCount().call());
    const rows = [];

    for (let agreementId = 1; agreementId <= totalAgreementCount; agreementId++) {
      const agreement = await escrowContract.methods.getAgreement(agreementId).call();
      let role = "";
      if (agreement.shipper.toLowerCase() === connectedAccount.toLowerCase()) role = "Shipper";
      if (agreement.carrier.toLowerCase() === connectedAccount.toLowerCase()) role = "Carrier";
      if (!role) continue;

      rows.push(
        "<tr><td>" + agreement.id + "</td>" +
        "<td>" + agreement.name + "</td>" +
        "<td>" + role + "</td>" +
        "<td>" + agreement.milestonesDone + " / " + agreement.milestoneCount + "</td>" +
        "<td>" + STATUS_NAMES[agreement.status] + "</td></tr>"
      );
    }

    document.querySelector("#myAgreementsTable tbody").innerHTML =
      rows.length ? rows.join("") : "<tr><td colspan='5'>No agreements found for this wallet.</td></tr>";
  } catch (error) {
    showFriendlyError(error, "Loading your agreements");
  }
};

// Loads one agreement and shows its progress and milestone plan.
const loadAgreementDetails = async () => {
  try {
    const agreementId = document.getElementById("viewId").value;
    const agreementCount = Number(await escrowContract.methods.agreementCount().call());
    if (!agreementId || Number(agreementId) < 1 || Number(agreementId) > agreementCount) {
      document.getElementById("agreementDetails").innerHTML = "";
      showStatusMessage("Agreement ID does not exist. Current IDs: 1 to " + agreementCount + ".", "error");
      return;
    }
    const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
    const escrowBalanceWei = await escrowContract.methods.escrowBalance(agreementId).call();
    const milestoneRows = [];

    // Read each step so the page can show a simple progress timeline.
    for (let index = 0; index < Number(agreementRecord.milestoneCount); index++) {
      const milestone = await escrowContract.methods.getMilestone(agreementId, index).call();
      const complete = index < Number(agreementRecord.milestonesDone);
      milestoneRows.push(
        "<div class='milestone-row " + (complete ? "complete" : "") + "'>" +
        "<span class='milestone-number'>" + (complete ? "✓" : index + 1) + "</span>" +
        "<div><strong>" + milestone.name + "</strong><p>" + milestone.description + "</p>" +
        "<p><b>Payout:</b> " + milestone.payoutPercentage + "% of the escrow</p>" +
        (milestone.submitted ? "<p><b>Carrier note:</b> " + milestone.submissionNote + "</p>" : "") +
        "</div>" +
        "<span class='milestone-status'>" + (complete ? "Verified" : milestone.submitted ? "Submitted" : "Pending") + "</span></div>"
      );
    }

    document.getElementById("agreementDetails").innerHTML =
      "<b>Name:</b> " + agreementRecord.name + "<br>" +
      "<b>ID:</b> " + agreementRecord.id + "<br>" +
      "<b>Shipper:</b> " + agreementRecord.shipper + "<br>" +
      "<b>Carrier:</b> " + agreementRecord.carrier + "<br>" +
      "<b>Declared payload value:</b> " + web3Client.utils.fromWei(agreementRecord.declaredPayloadValue, "ether") + " ETH<br>" +
      "<b>Total value:</b> " + web3Client.utils.fromWei(agreementRecord.totalValue, "ether") + " ETH<br>" +
      "<b>Milestones:</b> " + agreementRecord.milestonesDone + " / " + agreementRecord.milestoneCount + "<br>" +
      "<b>Released:</b> " + web3Client.utils.fromWei(agreementRecord.amountReleased, "ether") + " ETH<br>" +
      "<b>Escrow balance:</b> " + web3Client.utils.fromWei(escrowBalanceWei, "ether") + " ETH<br>" +
      "<b>Deadline:</b> " + new Date(agreementRecord.deadline * 1000).toLocaleString() + "<br>" +
      "<b>Status:</b> " + STATUS_NAMES[agreementRecord.status] + "<br>" +
      "<b>Carrier accepted:</b> " + (agreementRecord.carrierAccepted ? "Yes" : "Waiting") +
      "<div class='milestone-list'><h3>Milestones</h3>" + milestoneRows.join("") + "</div>";
  } catch (error) {
    showFriendlyError(error, "Loading agreement details");
  }
};

// build a transaction history from past events
// Loads blockchain events so the user can review the agreement history.
const loadAgreementHistory = async () => {
  try {
    const historyRows = [];
    const pastEvents = await escrowContract.getPastEvents("allEvents", {
      fromBlock: 0,
      toBlock: "latest",
    });

    pastEvents.forEach((eventRecord) => {
      historyRows.push(
        "<tr><td>" + eventRecord.event + "</td><td>" +
        JSON.stringify(cleanEventValues(eventRecord.returnValues)) +
        "</td></tr>"
      );
    });

    document.querySelector("#historyTable tbody").innerHTML =
      historyRows.length ? historyRows.join("") : "<tr><td colspan='2'>No events yet.</td></tr>";
    showStatusMessage("History loaded (" + pastEvents.length + " events).");
  } catch (error) {
    showFriendlyError(error, "Loading transaction history");
  }
};
