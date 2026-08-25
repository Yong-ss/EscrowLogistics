// Shared views (both roles): agreement details lookup + event history table.

const loadAgreementDetails = async () => {
  try {
    const agreementId = document.getElementById("viewId").value;
    const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
    const escrowBalanceWei = await escrowContract.methods.escrowBalance(agreementId).call();

    document.getElementById("agreementDetails").innerHTML =
      "<b>ID:</b> " + agreementRecord.id + "<br>" +
      "<b>Shipper:</b> " + agreementRecord.shipper + "<br>" +
      "<b>Carrier:</b> " + agreementRecord.carrier + "<br>" +
      "<b>Total value:</b> " + web3Client.utils.fromWei(agreementRecord.totalValue, "ether") + " ETH<br>" +
      "<b>Milestones:</b> " + agreementRecord.milestonesDone + " / " + agreementRecord.milestoneCount + "<br>" +
      "<b>Released:</b> " + web3Client.utils.fromWei(agreementRecord.amountReleased, "ether") + " ETH<br>" +
      "<b>Escrow balance:</b> " + web3Client.utils.fromWei(escrowBalanceWei, "ether") + " ETH<br>" +
      "<b>Deadline:</b> " + new Date(agreementRecord.deadline * 1000).toLocaleString() + "<br>" +
      "<b>Status:</b> " + STATUS_NAMES[agreementRecord.status];
  } catch (error) {
    showStatusMessage("Load failed: " + (error.message || error));
  }
};

// build a transaction history from past events
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
    showStatusMessage("History failed: " + (error.message || error));
  }
};
