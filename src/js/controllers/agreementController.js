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

let cachedAgreementRecords = [];
let currentFilter = "all";
let currentSearchQuery = "";
let currentSortOrder = "id_desc";

// Filters and sorts the cached agreement records and updates the UI.
const renderFilteredAgreements = () => {
  const list = document.getElementById("agreementList");
  const count = document.getElementById("agreementCount");
  if (!list) return;

  let filtered = [...cachedAgreementRecords];

  // 1. Search filter (by name, ID, or participant address)
  if (currentSearchQuery) {
    const q = currentSearchQuery.toLowerCase();
    filtered = filtered.filter(({ agreement }) =>
      agreement.name.toLowerCase().includes(q) ||
      String(agreement.id).includes(q) ||
      agreement.carrier.toLowerCase().includes(q) ||
      agreement.shipper.toLowerCase().includes(q)
    );
  }

  // 2. Status filter
  if (currentFilter === "pending") {
    filtered = filtered.filter(({ agreement }) => Number(agreement.status) === 0 && !agreement.carrierAccepted);
  } else if (currentFilter === "funded") {
    filtered = filtered.filter(({ agreement }) => Number(agreement.status) === 1);
  } else if (currentFilter === "completed") {
    filtered = filtered.filter(({ agreement }) => Number(agreement.status) === 2);
  } else if (currentFilter === "cancelled_refunded") {
    filtered = filtered.filter(({ agreement }) => Number(agreement.status) === 3 || Number(agreement.status) === 4);
  }

  // 3. Sorting
  filtered.sort((a, b) => {
    if (currentSortOrder === "id_desc") return Number(b.agreement.id) - Number(a.agreement.id);
    if (currentSortOrder === "id_asc") return Number(a.agreement.id) - Number(b.agreement.id);
    if (currentSortOrder === "deadline_soon") return Number(a.agreement.deadline) - Number(b.agreement.deadline);
    if (currentSortOrder === "val_high") {
      return BigInt(b.agreement.declaredPayloadValue) > BigInt(a.agreement.declaredPayloadValue) ? 1 : -1;
    }
    if (currentSortOrder === "val_low") {
      return BigInt(a.agreement.declaredPayloadValue) > BigInt(b.agreement.declaredPayloadValue) ? 1 : -1;
    }
    return 0;
  });

  if (count) {
    count.textContent = filtered.length + (filtered.length === 1 ? " agreement" : " agreements");
  }

  if (!filtered.length) {
    list.innerHTML = cachedAgreementRecords.length === 0
      ? "<p class='choice-empty'>No agreements are linked to this wallet yet.</p>"
      : "<p class='choice-empty'>No agreements match your filter or search criteria.</p>";
    return;
  }

  list.innerHTML = filtered.map(({ agreement, role }) => {
    const statusName = STATUS_NAMES[Number(agreement.status)] || "Unknown";
    const acceptanceText = Number(agreement.status) === 0 && !agreement.carrierAccepted
      ? "Waiting for Carrier"
      : statusName;
    return "<a class='agreement-card status-" + statusName.toLowerCase() + "' href='agreement-details.html?id=" + agreement.id + "'>" +
      "<div class='agreement-card-top'><span class='agreement-id'>Agreement #" + agreement.id +
      "</span><span class='status-pill status-" + statusName.toLowerCase() + "'>" + escapeHtmlForPage(acceptanceText) + "</span></div>" +
      "<h3>" + escapeHtmlForPage(agreement.name) + "</h3>" +
      "<div class='agreement-card-meta'><span>Role: " + escapeHtmlForPage(role) + "</span><span>" +
      agreement.milestonesDone + " / " + agreement.milestoneCount + " milestones</span></div>" +
      "<div class='agreement-card-bottom'><span>" +
      web3Client.utils.fromWei(agreement.declaredPayloadValue, "ether") + " ETH escrow</span>" +
      "<span class='card-arrow'>View details →</span></div></a>";
  }).join("");
};

// Handlers for search input, status filter pills, and sort dropdown.
const handleAgreementSearch = (value) => {
  currentSearchQuery = (value || "").trim();
  renderFilteredAgreements();
};

const handleAgreementSort = (value) => {
  currentSortOrder = value || "id_desc";
  renderFilteredAgreements();
};

const handleAgreementFilter = (filterKey) => {
  currentFilter = filterKey || "all";
  document.querySelectorAll("#statusFilterPills .filter-pill").forEach((pill) => {
    pill.classList.toggle("active", pill.dataset.filter === currentFilter);
  });
  renderFilteredAgreements();
};

// Shows only this wallet's agreements as cards with a normal details link.
const loadMyAgreements = async () => {
  try {
    const records = await getMyAgreementRecords();
    if (!records) return;
    cachedAgreementRecords = records;
    renderFilteredAgreements();
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
      showStatusMessage("This agreement link is incomplete. Go back and choose an agreement.", "warning");
      return;
    }

    const records = await getMyAgreementRecords();
    const selectedRecord = records && records.find(({ agreement }) => String(agreement.id) === String(agreementId));
    if (!selectedRecord) {
      showStatusMessage("This agreement is not linked to the current wallet.", "warning");
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

  const milestones = [];
  // Read each step so the page can show a simple progress timeline.
  for (let index = 0; index < Number(agreementRecord.milestoneCount); index++) {
    const milestone = await escrowContract.methods.getMilestone(agreementId, index).call();
    milestones.push(milestone);
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
  if (status) {
    const statusName = STATUS_NAMES[Number(agreementRecord.status)] || "Unknown";
    status.textContent = statusName;
    status.className = "status-pill status-" + statusName.toLowerCase();
  }

  // Shipper cancellation button for unfunded drafts
  const actionButtons = document.getElementById("agreementActionButtons");
  if (actionButtons) {
    const isShipper = connectedAccount && connectedAccount.toLowerCase() === agreementRecord.shipper.toLowerCase();
    const isUnfunded = Number(agreementRecord.status) === 0;
    if (isShipper && isUnfunded) {
      actionButtons.innerHTML =
        "<div class='cancellation-banner'>" +
        "<span><strong>Unfunded draft:</strong> This agreement has not received escrow funds. You can cancel it if not needed.</span>" +
        "<button type='button' class='button button-danger' onclick=\"cancelSelectedAgreement('" + agreementRecord.id + "')\">✕ Cancel agreement</button>" +
        "</div>";
    } else {
      actionButtons.innerHTML = "";
    }
  }

  document.getElementById("agreementDetails").innerHTML =
    "<div class='detail-grid'>" + detailFields.map(([label, value]) => {
      let valueHtml = escapeHtmlForPage(value);
      if ((label === "Shipper" || label === "Carrier") && typeof value === "string" && value.startsWith("0x")) {
        valueHtml = "<span class='detail-address-row'>" +
          "<code class='address-code' title='" + escapeHtmlForPage(value) + "'>" + (typeof shortenAddress === "function" ? shortenAddress(value) : value) + "</code>" +
          "<button type='button' class='button-mini-copy' onclick=\"copyTextToClipboard('" + escapeHtmlForPage(value) + "', '" + label + " address', this)\" title='Copy full " + label + " address'>📋 Copy</button>" +
          "</span>";
      }
      return "<div class='detail-item'><span>" + label + "</span><strong>" + valueHtml + "</strong></div>";
    }).join("") + "</div>" +
    "<div id='detailsMilestoneTracker'></div>" +
    "<div class='milestone-list'><h3>Milestone breakdown</h3>" + milestoneRows.join("") + "</div>";

  // Render the animated step tracker
  renderMilestoneStepTracker("detailsMilestoneTracker", agreementRecord, milestones, { role: "viewer" });
};

// Cancels an unfunded agreement on-chain.
const cancelSelectedAgreement = async (agreementId) => {
  if (!confirm("Are you sure you want to cancel Agreement #" + agreementId + "? This will discard this draft.")) {
    return;
  }
  try {
    showStatusMessage("Submitting cancellation to blockchain. Confirm in MetaMask...");
    await sendWithEstimatedGas(
      escrowContract.methods.cancelAgreement(agreementId),
      { from: connectedAccount }
    );
    showStatusMessage("Agreement #" + agreementId + " has been cancelled.", "success");
    await loadSelectedAgreementDetails();
  } catch (error) {
    showFriendlyError(error, "Cancelling the agreement");
  }
};

// Triggers the browser print dialog with the styled Bill of Lading layout.
const printBillOfLading = () => {
  window.print();
};

// Builds a readable history timeline for the selected agreement only.
const loadAgreementHistory = async (agreementId, agreementName = "") => {
  const historyList = document.getElementById("historyList");
  if (historyList) {
    historyList.innerHTML = "<div class='history-loading' role='status' aria-live='polite'><span class='history-loading-spinner' aria-hidden='true'></span><span>Loading agreement activity...</span></div>";
  }

  try {
    // Read the complete contract history in RPC-safe chunks so older agreements remain visible.
    const latestBlock = await web3Client.eth.getBlockNumber();
    const pastEvents = [];
    let toBlock = latestBlock;
    let chunkSize = 10000;
    while (toBlock >= 0) {
      const fromBlock = Math.max(0, toBlock - chunkSize + 1);
      try {
        const chunk = await escrowContract.getPastEvents("allEvents", { fromBlock, toBlock });
        pastEvents.push(...chunk);
        if (chunk.some((eventRecord) => eventRecord.event === "AgreementCreated" &&
          String(eventRecord.returnValues.id) === String(agreementId))) break;
        toBlock = fromBlock - 1;
      } catch (error) {
        if (chunkSize <= 500) throw error;
        chunkSize = Math.floor(chunkSize / 2);
      }
    }

    // An agreement ID is unique, so this removes events from every other agreement.
    const relevantEvents = pastEvents
      .filter((eventRecord) => eventRecord.event !== "Registered" &&
        String(eventRecord.returnValues.id) === String(agreementId))
      .sort((first, second) => Number(first.blockNumber) - Number(second.blockNumber) ||
        Number(first.logIndex) - Number(second.logIndex));

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
