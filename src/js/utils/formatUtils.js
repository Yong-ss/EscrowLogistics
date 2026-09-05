// Lookup tables + small formatting helpers shared by every controller.

const ROLE_NAMES = ["None", "Shipper", "Carrier"];
const STATUS_NAMES = ["Created", "Funded", "Completed", "Refunded"];

// shorten an address for table display, e.g. 0xdF61...6ee8
// Keeps long wallet addresses readable in tables.
function shortenAddress(address) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

// Converts a blockchain event into one short sentence for the history table.
function formatHistoryEvent(eventRecord, agreementName) {
  const values = eventRecord.returnValues || {};
  const agreementLabel = agreementName || (values.id ? "Agreement #" + values.id : "Account");

  switch (eventRecord.event) {
    case "Registered":
      return { category: "ACCOUNT", agreement: "Account", detail: "Registered as " + (ROLE_NAMES[Number(values.role)] || "user") + "." };
    case "AgreementCreated":
      return { category: "AGREEMENT", agreement: agreementLabel, detail: "Agreement created and sent to the Carrier for acceptance." };
    case "AgreementAccepted":
      return { category: "AGREEMENT", agreement: agreementLabel, detail: "Carrier accepted the agreement." };
    case "Funded":
      return { category: "ESCROW", agreement: agreementLabel, detail: "Shipper locked " + web3Client.utils.fromWei(values.amount, "ether") + " ETH in escrow." };
    case "MilestoneSubmitted":
      return { category: "MILESTONE", agreement: agreementLabel, detail: "Carrier submitted Milestone " + values.milestoneNo + " for review." };
    case "MilestoneVerified":
      return { category: "PAYMENT", agreement: agreementLabel, detail: "Milestone " + values.milestoneNo + " verified; " + web3Client.utils.fromWei(values.payout, "ether") + " ETH paid to Carrier." };
    case "AgreementCompleted":
      return { category: "AGREEMENT", agreement: agreementLabel, detail: "All milestones verified and the agreement completed." };
    case "Refunded":
      return { category: "REFUND", agreement: agreementLabel, detail: "Deadline refund returned " + web3Client.utils.fromWei(values.amount, "ether") + " ETH to the Shipper." };
    default:
      return { category: "AGREEMENT", agreement: agreementLabel, detail: "A blockchain update was recorded." };
  }
}

// Keeps event text safe when it is inserted into the history table.
function escapeHtmlForPage(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
}
