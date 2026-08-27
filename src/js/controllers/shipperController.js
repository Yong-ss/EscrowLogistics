// Shipper actions: create an agreement, fund it, verify milestones, refund.

const createNewAgreement = async () => {
  try {
    const carrierAddressInput = document.getElementById("carrierAddr").value;
    const milestoneCountInput = document.getElementById("milestoneCount").value;
    const payloadValueEther = document.getElementById("payloadValue").value;
    const payloadValueWei = web3Client.utils.toWei(payloadValueEther, "ether");
    const deadlineMinutesInput = parseInt(document.getElementById("deadlineMins").value, 10);
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadlineMinutesInput * 60;

    const result = await escrowContract.methods
      .createAgreement(carrierAddressInput, milestoneCountInput, payloadValueWei, deadlineTimestamp)
      .send({ from: connectedAccount });

    const agreementId = result.events.AgreementCreated.returnValues.id;
    showStatusMessage("Agreement created with ID " + agreementId + ".");
  } catch (error) {
    showStatusMessage("Create failed: " + (error.message || error));
  }
};

// fund an agreement (lock Ether into escrow)
const fundAgreementEscrow = async () => {
  try {
    const agreementId = document.getElementById("fundId").value;
    const fundAmountEther = document.getElementById("fundAmount").value;
    const fundAmountWei = web3Client.utils.toWei(fundAmountEther, "ether");

    await escrowContract.methods.fund(agreementId).send({ from: connectedAccount, value: fundAmountWei });
    showStatusMessage("Funded agreement " + agreementId + " with " + fundAmountEther + " ETH.");
  } catch (error) {
    showStatusMessage("Fund failed: " + (error.message || error));
  }
};

// verify the next milestone (releases a payout share to the carrier)
const verifyNextMilestone = async () => {
  try {
    const agreementId = document.getElementById("verifyId").value;
    const result = await escrowContract.methods.verifyMilestone(agreementId).send({ from: connectedAccount });
    const milestoneEvent = result.events.MilestoneVerified.returnValues;
    const payoutEther = web3Client.utils.fromWei(milestoneEvent.payout, "ether");
    showStatusMessage("Milestone " + milestoneEvent.milestoneNo + " verified, paid " + payoutEther + " ETH to carrier.");
  } catch (error) {
    showStatusMessage("Verify failed: " + (error.message || error));
  }
};

// trigger a refund after the deadline
const requestRefund = async () => {
  try {
    const agreementId = document.getElementById("refundId").value;
    const result = await escrowContract.methods.refund(agreementId).send({ from: connectedAccount });
    const refundedEther = web3Client.utils.fromWei(result.events.Refunded.returnValues.amount, "ether");
    showStatusMessage("Refunded " + refundedEther + " ETH to shipper for agreement " + agreementId + ".");
  } catch (error) {
    showStatusMessage("Refund failed: " + (error.message || error));
  }
};
