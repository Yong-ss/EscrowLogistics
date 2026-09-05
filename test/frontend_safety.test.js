const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

// Checks the small frontend safety helpers that protect the user from raw RPC errors.
describe("Frontend transaction safety", () => {
  const projectRoot = path.join(__dirname, "..");
  const domUtils = fs.readFileSync(
    path.join(projectRoot, "src", "js", "utils", "domUtils.js"),
    "utf8"
  );
  const contractConnection = fs.readFileSync(
    path.join(projectRoot, "src", "js", "services", "contractConnection.js"),
    "utf8"
  );
  const pageController = fs.readFileSync(
    path.join(projectRoot, "src", "js", "controllers", "pageController.js"),
    "utf8"
  );
  const controllerPaths = [
    "registerController.js",
    "carrierController.js",
    "shipperController.js",
  ].map((fileName) => path.join(projectRoot, "src", "js", "controllers", fileName));

  it("uses one gas estimation helper for every blockchain write", () => {
    assert(domUtils.includes("async function sendWithEstimatedGas"));
    assert(domUtils.includes("transaction.estimateGas(options)"));
    controllerPaths.forEach((filePath) => {
      const controller = fs.readFileSync(filePath, "utf8");
      assert(controller.includes("sendWithEstimatedGas"), filePath);
      assert(!controller.includes(".send("), filePath);
    });
  });

  it("explains when the configured contract is missing on the connected network", () => {
    assert(contractConnection.includes("getCode"));

    const context = {};
    vm.createContext(context);
    vm.runInContext(domUtils, context);

    const message = context.getFriendlyError(
      { message: "Escrow contract is not deployed on this network" },
      "Connecting your wallet"
    );

    assert(message.includes("contract"));
    assert(message.includes("network"));
  });

  it("keeps a successful action readable when the RPC receipt has no decoded event", () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(domUtils, context);

    assert.equal(context.getEventReturnValues({ events: {} }, "Refunded"), null);
    assert.equal(context.getEventReturnValues({}, "MilestoneVerified"), null);
  });

  it("translates common provider failures into a next step", () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(domUtils, context);

    assert(context.getFriendlyError({ message: "nonce too low" }, "Funding the agreement").includes("pending"));
    assert(context.getFriendlyError({ message: "Failed to fetch" }, "Loading your agreements").includes("network"));
    assert(context.getFriendlyError({ message: "execution reverted: Unknown rule" }, "Verifying the milestone").includes("blockchain rejected"));
  });

  it("does not leave the Shipper agreement selection as an unhandled promise", () => {
    const controller = fs.readFileSync(
      path.join(projectRoot, "src", "js", "controllers", "shipperController.js"),
      "utf8"
    );
    const selectionStart = controller.indexOf("const chooseShipperAgreement");
    const selectionEnd = controller.indexOf("// Shows the current milestone", selectionStart);
    const selectionFunction = controller.slice(selectionStart, selectionEnd);
    assert(selectionFunction.includes("catch (error)"));
  });

  it("does not show Ganache-only wording while creating on another network", () => {
    const controller = fs.readFileSync(
      path.join(projectRoot, "src", "js", "controllers", "shipperController.js"),
      "utf8"
    );
    assert(!controller.includes("with Ganache"));
  });

  it("loads Carrier dashboard data only on the My Jobs page", () => {
    assert(pageController.includes('document.body.dataset.page === "jobs"'));
    assert(pageController.includes("loadCarrierDashboard"));
  });

  it("translates nested public-RPC deadline errors", () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(domUtils, context);

    const message = context.getFriendlyError(
      { data: { reason: "execution reverted: Deadline has passed" } },
      "Submitting the milestone"
    );

    assert(message.includes("past its deadline"));
    assert(!message.includes("stopped before MetaMask"));
  });

  it("translates gas-limit errors and does not claim a sent transaction stopped before MetaMask", () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(domUtils, context);

    const message = context.getFriendlyError(
      { message: "RPC error: transaction gas limit too high" },
      "Submitting the milestone"
    );

    assert(message.includes("gas limit"));
    assert(!message.includes("stopped before MetaMask"));
  });
});
