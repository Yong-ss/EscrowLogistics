// Small helpers for updating the page - no contract logic here.

// Shows a short message that normal users can understand.
function showStatusMessage(message, type = "success") {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = message;
  status.className = "status-message " + type;
}

// Turns long MetaMask and Solidity errors into a useful next step for the user.
function getFriendlyError(error, action) {
  // Some Web3 providers hide the Solidity reason inside nested error data.
  let raw = String((error && error.message) || error || "");
  try { raw += " " + JSON.stringify(error); } catch (ignored) { /* keep the readable message */ }
  raw = raw.toLowerCase();

  if (raw.includes("user denied") || raw.includes("user rejected") || raw.includes("4001")) {
    return "Transaction cancelled in MetaMask. Nothing was changed.";
  }
  if (raw.includes("isaddress is not a function")) {
    return "The wallet connection library did not load correctly. Refresh the page and try again.";
  }
  if (raw.includes("invalid number") || raw.includes("invalid address") || raw.includes("invalid value")) {
    return "One of the form values is not valid. Check the Carrier address, amount, and milestone fields.";
  }
  if (raw.includes("cannot read properties") || raw.includes("is not a function")) {
    return "The page was not ready when the form was submitted. Refresh the page and try again.";
  }
  if (raw.includes("carrier has not submitted")) {
    return "This milestone is not ready yet. Ask the Carrier to submit a completion note first.";
  }
  if (raw.includes("carrier has not accepted")) {
    return "The Carrier has not accepted this agreement yet. Funding is available after acceptance.";
  }
  if (raw.includes("deadline has passed")) {
    return "This agreement is past its deadline, so the next milestone cannot be verified.";
  }
  if (raw.includes("deadline must be in the future")) {
    return "The deadline must be later than the current Ganache time. Increase the deadline and try again.";
  }
  if (raw.includes("deadline has not passed")) {
    return "A refund can only be requested after the agreement deadline.";
  }
  if (raw.includes("funded amount must match")) {
    return "The funding amount does not match the amount agreed in this agreement.";
  }
  if (raw.includes("only the assigned carrier")) {
    return "This wallet is not the Carrier assigned to this agreement.";
  }
  if (raw.includes("only the shipper of this agreement")) {
    return "Only the Shipper who created this agreement can perform this action.";
  }
  if (raw.includes("only a registered shipper")) {
    return "Please register this wallet as a Shipper before creating an agreement.";
  }
  if (raw.includes("only a registered carrier")) {
    return "Please register this wallet as a Carrier before accepting an agreement.";
  }
  if (raw.includes("address already registered")) {
    return "This wallet is already registered and cannot choose another role.";
  }
  if (raw.includes("assigned address is not a carrier")) {
    return "The assigned wallet is not registered as a Carrier. Check the address and try again.";
  }
  if (raw.includes("agreement name is required")) {
    return "Please give this agreement a name before creating it.";
  }
  if (raw.includes("need at least one milestone")) {
    return "Add at least one milestone to this agreement.";
  }
  if (raw.includes("milestone name is required")) {
    return "Every milestone needs a name before the agreement can be created.";
  }
  if (raw.includes("milestone names do not match") || raw.includes("milestone descriptions do not match")) {
    return "The milestone information does not match the milestone count. Check the form and try again.";
  }
  if (raw.includes("declared payload value must be greater")) {
    return "The total escrow amount must be greater than zero ETH.";
  }
  if (raw.includes("payout percentage must be 1 to 100")) {
    return "Each milestone payout share must be between 1% and 100%.";
  }
  if (raw.includes("payout percentages must total 100")) {
    return "Milestone payout shares must add up to exactly 100%.";
  }
  if (raw.includes("agreement does not exist")) {
    return "This agreement could not be found. Please choose an agreement from the list.";
  }
  if (raw.includes("agreement is not awaiting acceptance")) {
    return "This agreement is no longer waiting for Carrier acceptance.";
  }
  if (raw.includes("agreement is not awaiting funding")) {
    return "This agreement is not ready for funding. Check its current status.";
  }
  if (raw.includes("agreement is not in progress")) {
    return "This agreement is not currently in progress.";
  }
  if (raw.includes("all milestones already done")) {
    return "All milestones are already verified for this agreement.";
  }
  if (raw.includes("milestone already submitted")) {
    return "This milestone has already been submitted and is waiting for review.";
  }
  if (raw.includes("completion note is required")) {
    return "Please write a short completion note before submitting the milestone.";
  }
  if (raw.includes("insufficient funds") || raw.includes("insufficient balance")) {
    return "Your wallet does not have enough ETH to complete this transaction.";
  }
  if (raw.includes("network") || raw.includes("wrong chain") || raw.includes("chainid")) {
    return "MetaMask may be connected to the wrong network. Connect it to the Ganache network and try again.";
  }
  return action + " stopped before MetaMask. Press F12, open Console, and check the red error for the exact cause.";
}

// Logs the technical detail for debugging but keeps it away from normal users.
function showFriendlyError(error, action) {
  console.error(action + " error:", error);
  showStatusMessage(getFriendlyError(error, action), "error");
}

// Makes one page section visible.
function showPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.remove("hidden");
}

// Hides one page section without failing on pages that do not have it.
function hidePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add("hidden");
}
