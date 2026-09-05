// Shared agreement views: the list page and one agreement's details page.

// Finds agreements where the connected wallet is either the Shipper or Carrier.
const getMyAgreementRecords = async () => {
  if (!connectedAccount || !escrowContract) return null;

  const totalAgreementCount = Number(await escrowContract.methods.agreementCount().call());
  const records = [];
  for (let agreementId = 1; agreementId <= totalAgreementCount; agreementId++) {
    const agreement = await escrowContract.methods.getAgreement(agreementId).call();
    let role = "";
    if (agreement.shipper.toLowerCase() === connectedAccount.toLowerCase()) role = "Shipper";
    if (agreement.carrier.toLowerCase() === connectedAccount.toLowerCase()) role = "Carrier";
    if (role) records.push({ agreement, role });
  }
  return records;
};

// Shows only this wallet's agreements as cards with a normal details link.
const loadMyAgreements = async () => {
  try {
    const records = await getMyAgreementRecords();
    const list = document.getElementById("agreementList");
    const count = document.getElementById("agreementCount");
    if (!records || !list) return;

    if (count) count.textContent = records.length + (records.length === 1 ? " agreement" : " agreements");
    if (!records.length) {
      list.innerHTML = "<p class='choice-empty'>No agreements are linked to this wallet yet.</p>";
      return;
    }

    list.innerHTML = records.map(({ agreement, role }) => {
      const statusName = STATUS_NAMES[Number(agreement.status)] || "Unknown";
      const acceptanceText = Number(agreement.status) === 0 && !agreement.carrierAccepted
        ? "Waiting for Carrier"
        : statusName;
      return "<a class='agreement-card' href='agreement-details.html?id=" + agreement.id + "'>" +
        "<div class='agreement-card-top'><span class='agreement-id'>Agreement #" + agreement.id +
        "</span><span class='status-pill'>" + escapeHtmlForPage(acceptanceText) + "</span></div>" +
        "<h3>" + escapeHtmlForPage(agreement.name) + "</h3>" +
        "<div class='agreement-card-meta'><span>" + escapeHtmlForPage(role) + "</span><span>" +
        agreement.milestonesDone + " / " + agreement.milestoneCount + " milestones</span></div>" +
        "<div class='agreement-card-bottom'><span>" +
        web3Client.utils.fromWei(agreement.declaredPayloadValue, "ether") + " ETH escrow</span>" +
        "<span class='card-arrow'>View details →</span></div></a>";
    }).join("");
  } catch (error) {
    showFriendlyError(error, "Loading your agreements");
  }
};

// Reads the agreement ID from the details link instead of asking the user to type it.
const getAgreementIdFromDetailsLink = () => {
  const query = new URLSearchParams(window.location.search);
  const agreementId = query.get("id");
  return /^[1-9][0-9]*$/.test(agreementId || "") ? agreementId : "";
};

// Opens one agreement only after confirming that this wallet is a participant.
const loadSelectedAgreementDetails = async () => {
  try {
    const agreementId = getAgreementIdFromDetailsLink();
    if (!agreementId) {
      showStatusMessage("This agreement link is incomplete. Go back and choose an agreement.", "error");
      return;
    }

    const records = await getMyAgreementRecords();
    const selectedRecord = records && records.find(({ agreement }) => String(agreement.id) === String(agreementId));
    if (!selectedRecord) {
      showStatusMessage("This agreement is not linked to the current wallet.", "error");
      return;
    }

    showPanel("agreementDetailsSection");
    showPanel("agreementHistorySection");
    await loadAgreementDetails(agreementId, selectedRecord.agreement);
    await loadAgreementHistory(agreementId, selectedRecord.agreement.name);
  } catch (error) {
    showFriendlyError(error, "Loading the agreement");
  }
};

// Loads one agreement and shows its progress and milestone plan.
const loadAgreementDetails = async (agreementId, knownAgreement = null) => {
  const agreementRecord = knownAgreement || await escrowContract.methods.getAgreement(agreementId).call();
  const escrowBalanceWei = await escrowContract.methods.escrowBalance(agreementId).call();
  const milestoneRows = [];

  // Read each step so the page can show a simple progress timeline.
  for (let index = 0; index < Number(agreementRecord.milestoneCount); index++) {
    const milestone = await escrowContract.methods.getMilestone(agreementId, index).call();
    const complete = index < Number(agreementRecord.milestonesDone);
    milestoneRows.push(
      "<div class='milestone-row " + (complete ? "complete" : "") + "'>" +
      "<span class='milestone-number'>" + (complete ? "✓" : index + 1) + "</span>" +
      "<div><strong>" + escapeHtmlForPage(milestone.name) + "</strong><p>" +
      escapeHtmlForPage(milestone.description) + "</p><p><b>Payout:</b> " +
      milestone.payoutPercentage + "% of the escrow</p>" +
      (milestone.submitted ? "<p><b>Carrier note:</b> " + escapeHtmlForPage(milestone.submissionNote) + "</p>" : "") +
      "</div><span class='milestone-status'>" +
      (complete ? "Verified" : milestone.submitted ? "Submitted" : "Pending") +
      "</span></div>"
    );
  }

  const detailFields = [
    ["Agreement ID", agreementRecord.id],
    ["Shipper", agreementRecord.shipper],
    ["Carrier", agreementRecord.carrier],
    ["Total escrow", web3Client.utils.fromWei(agreementRecord.declaredPayloadValue, "ether") + " ETH"],
    ["Released to Carrier", web3Client.utils.fromWei(agreementRecord.amountReleased, "ether") + " ETH"],
    ["Remaining escrow", web3Client.utils.fromWei(escrowBalanceWei, "ether") + " ETH"],
    ["Deadline", new Date(Number(agreementRecord.deadline) * 1000).toLocaleString()],
    ["Carrier acceptance", agreementRecord.carrierAccepted ? "Accepted" : "Waiting for acceptance"]
  ];

  const title = document.getElementById("agreementTitle");
  const status = document.getElementById("agreementStatus");
  if (title) title.textContent = agreementRecord.name;
  if (status) status.textContent = STATUS_NAMES[Number(agreementRecord.status)] || "Unknown";

  document.getElementById("agreementDetails").innerHTML =
    "<div class='detail-grid'>" + detailFields.map(([label, value]) =>
      "<div class='detail-item'><span>" + label + "</span><strong>" + escapeHtmlForPage(value) + "</strong></div>"
    ).join("") + "</div>" +
    "<div class='milestone-list'><h3>Milestone plan</h3>" + milestoneRows.join("") + "</div>";
};

// Builds a readable history timeline for the selected agreement only.
const loadAgreementHistory = async (agreementId, agreementName = "") => {
  try {
    const pastEvents = await escrowContract.getPastEvents("allEvents", {
      fromBlock: 0,
      toBlock: "latest",
    });

    // An agreement ID is unique, so this removes events from every other agreement.
    const relevantEvents = pastEvents
      .filter((eventRecord) => eventRecord.event !== "Registered" &&
        String(eventRecord.returnValues.id) === String(agreementId))
      .sort((first, second) => Number(first.blockNumber) - Number(second.blockNumber) ||
        Number(first.logIndex) - Number(second.logIndex));

    const historyList = document.getElementById("historyList");
    if (!historyList) return;
    const historyItems = await Promise.all(relevantEvents.map(async (eventRecord) => {
      const formatted = formatHistoryEvent(eventRecord, agreementName);
      let occurredAt = "Time unavailable";

      // Events store a block number, so read that block once to show a useful date.
      try {
        const block = await web3Client.eth.getBlock(eventRecord.blockNumber);
        if (block && block.timestamp) {
          occurredAt = new Date(Number(block.timestamp) * 1000).toLocaleString();
        }
      } catch (ignored) {
        // The block number and event text are still useful if the date lookup fails.
      }

      return "<div class='history-item'><span class='history-dot'></span><div>" +
        "<div class='history-item-top'><span class='history-type history-type-" +
        formatted.category.toLowerCase() + "'>" + formatted.category + "</span></div>" +
        "<strong>" + escapeHtmlForPage(formatted.detail) + "</strong><small>Date " +
        occurredAt + " · Block " + eventRecord.blockNumber + "</small></div></div>";
    }));
    historyList.innerHTML = historyItems.length
      ? historyItems.join("")
      : "<p class='choice-empty'>No blockchain actions have been recorded for this agreement yet.</p>";
  } catch (error) {
    showFriendlyError(error, "Loading agreement history");
  }
};
