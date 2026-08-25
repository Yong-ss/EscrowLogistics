// Carrier dashboard: reputation points + the list of jobs assigned to this account.

const loadCarrierDashboard = async () => {
  const reputationPoints = await escrowContract.methods.reputation(connectedAccount).call();
  document.getElementById("repPoints").innerHTML = reputationPoints;
  await loadCarrierJobs();
};

// list every agreement where the connected account is the carrier
const loadCarrierJobs = async () => {
  try {
    const totalAgreementCount = Number(await escrowContract.methods.agreementCount().call());
    const jobRows = [];

    for (let agreementId = 1; agreementId <= totalAgreementCount; agreementId++) {
      const agreementRecord = await escrowContract.methods.getAgreement(agreementId).call();
      if (agreementRecord.carrier.toLowerCase() !== connectedAccount.toLowerCase()) continue;

      jobRows.push(
        "<tr><td>" + agreementRecord.id + "</td>" +
        "<td>" + shortenAddress(agreementRecord.shipper) + "</td>" +
        "<td>" + web3Client.utils.fromWei(agreementRecord.totalValue, "ether") + "</td>" +
        "<td>" + agreementRecord.milestonesDone + " / " + agreementRecord.milestoneCount + "</td>" +
        "<td>" + web3Client.utils.fromWei(agreementRecord.amountReleased, "ether") + "</td>" +
        "<td>" + STATUS_NAMES[agreementRecord.status] + "</td></tr>"
      );
    }

    document.querySelector("#jobsTable tbody").innerHTML =
      jobRows.length ? jobRows.join("") : "<tr><td colspan='6'>No jobs assigned to you yet.</td></tr>";
    showStatusMessage("Loaded " + jobRows.length + " job(s).");
  } catch (error) {
    showStatusMessage("Load jobs failed: " + (error.message || error));
  }
};
