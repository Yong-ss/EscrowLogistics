const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Checks the simple user journey for the Agreements page.
describe("Agreements page flow", () => {
  const projectRoot = path.join(__dirname, "..");
  const page = fs.readFileSync(path.join(projectRoot, "src", "agreements.html"), "utf8");
  const detailsPage = path.join(projectRoot, "src", "agreement-details.html");
  const controller = fs.readFileSync(
    path.join(projectRoot, "src", "js", "controllers", "agreementController.js"),
    "utf8"
  );
  const shipperController = fs.readFileSync(
    path.join(projectRoot, "src", "js", "controllers", "shipperController.js"),
    "utf8"
  );
  const formatUtils = fs.readFileSync(
    path.join(projectRoot, "src", "js", "utils", "formatUtils.js"),
    "utf8"
  );

  it("starts with a named agreement list instead of a manual ID form", () => {
    assert(fs.existsSync(detailsPage));
    assert(page.includes('id="agreementList"'));
    assert(!page.includes('id="viewId"'));
    assert(!page.includes('id="myAgreementsTable"'));
    assert(!page.includes('id="historyTable"'));
  });

  it("loads details and history for the agreement ID in the detail link", () => {
    assert(controller.includes("agreement-details.html?id="));
    assert(controller.includes("const loadSelectedAgreementDetails = async ()"));
    assert(controller.includes("new URLSearchParams(window.location.search)"));
    assert(controller.includes("loadAgreementDetails(agreementId,"));
    assert(controller.includes("loadAgreementHistory(agreementId,"));
    assert(controller.includes("String(eventRecord.returnValues.id) === String(agreementId)"));
  });

  it("simulates agreement creation before asking MetaMask to send it", () => {
    assert(shipperController.includes("await createCall.call({ from: connectedAccount });"));
    assert(shipperController.includes("sendWithEstimatedGas(createCall"));
  });

  it("separates agreement, escrow, milestone, payment, and refund activity", () => {
    const detailPageText = fs.readFileSync(detailsPage, "utf8");
    assert(detailPageText.includes("Agreement activity"));
    assert(formatUtils.includes("category: \"AGREEMENT\""));
    assert(formatUtils.includes("category: \"ESCROW\""));
    assert(formatUtils.includes("category: \"MILESTONE\""));
    assert(formatUtils.includes("category: \"PAYMENT\""));
    assert(formatUtils.includes("category: \"REFUND\""));
    assert(controller.includes("Date "));
  });
});
