// Small helpers for updating the page - no contract logic here.

// Configuration for notification types: light blue, green, red, yellow, orange
const NOTIFICATION_THEMES = {
  info: {
    label: "Information",
    icon: "ℹ",
    toastClass: "toast-info",
    statusClass: "info",
  },
  success: {
    label: "Success",
    icon: "✓",
    toastClass: "toast-success",
    statusClass: "success",
  },
  error: {
    label: "Error",
    icon: "✕",
    toastClass: "toast-error",
    statusClass: "error",
  },
  warning: {
    label: "Warning",
    icon: "⚠",
    toastClass: "toast-warning",
    statusClass: "warning",
  },
  required: {
    label: "Required",
    icon: "✱",
    toastClass: "toast-required",
    statusClass: "required",
  },
};

// Gets or injects the floating toast container with high proximity to user view
function getOrCreateToastContainer() {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  return container;
}

// Shows a modern notification alert (floating toast + formatted inline status)
function showStatusMessage(message, rawType = "info") {
  if (!message) return;

  // Normalize type string
  let type = String(rawType || "info").toLowerCase().trim();
  if (type === "information") type = "info";
  if (type === "warn") type = "warning";
  if (!NOTIFICATION_THEMES[type]) type = "info";

  const theme = NOTIFICATION_THEMES[type];
  const safeText = typeof escapeHtmlForPage === "function" ? escapeHtmlForPage(message) : message;

  // 1. Update inline #status element if present on the page
  const statusEl = document.getElementById("status");
  if (statusEl) {
    if (statusEl._dismissTimer) clearTimeout(statusEl._dismissTimer);
    statusEl.classList.remove("status-fade-out");
    statusEl.className = "status-message " + theme.statusClass;
    statusEl.innerHTML = `
      <span class="status-icon" aria-hidden="true">${theme.icon}</span>
      <div class="status-content">
        <strong class="status-label">${theme.label}:</strong>
        <span class="status-text">${safeText}</span>
      </div>
      <button type="button" class="status-close-btn" aria-label="Close notification">✕</button>
    `;

    // Manual close button
    const statusCloseBtn = statusEl.querySelector(".status-close-btn");
    if (statusCloseBtn) {
      statusCloseBtn.addEventListener("click", () => dismissStatusElement(statusEl));
    }

    // Auto dismiss after 4.5 seconds
    statusEl._dismissTimer = setTimeout(() => {
      dismissStatusElement(statusEl);
    }, 4500);

    // Pause timer on hover, resume on mouse leave
    statusEl.onmouseenter = () => {
      if (statusEl._dismissTimer) clearTimeout(statusEl._dismissTimer);
    };
    statusEl.onmouseleave = () => {
      statusEl._dismissTimer = setTimeout(() => {
        dismissStatusElement(statusEl);
      }, 2000);
    };
  }

  // 2. Spawn modern floating toast with optimal visual proximity
  const container = getOrCreateToastContainer();

  // Limit stacked toasts to 4
  while (container.children.length >= 4) {
    container.firstElementChild.remove();
  }

  const toast = document.createElement("div");
  toast.className = `toast ${theme.toastClass} toast-enter`;
  toast.innerHTML = `
    <span class="toast-indicator"></span>
    <span class="toast-icon-wrap" aria-hidden="true">${theme.icon}</span>
    <div class="toast-body">
      <div class="toast-label">${theme.label}</div>
      <div class="toast-text">${safeText}</div>
    </div>
    <button type="button" class="toast-close-btn" aria-label="Close notification">✕</button>
  `;

  // Manual dismiss
  const closeBtn = toast.querySelector(".toast-close-btn");
  if (closeBtn && typeof closeBtn.addEventListener === "function") {
    closeBtn.addEventListener("click", () => dismissToast(toast));
  }

  container.appendChild(toast);

  // Auto dismiss after 4.5 seconds
  let dismissTimer = setTimeout(() => dismissToast(toast), 4500);

  // Pause timer on hover
  toast.addEventListener("mouseenter", () => clearTimeout(dismissTimer));
  toast.addEventListener("mouseleave", () => {
    dismissTimer = setTimeout(() => dismissToast(toast), 2500);
  });
}

// Dismisses the inline status banner with a smooth fade-out
function dismissStatusElement(statusEl) {
  if (!statusEl) return;
  if (statusEl._dismissTimer) {
    clearTimeout(statusEl._dismissTimer);
    statusEl._dismissTimer = null;
  }
  statusEl.classList.add("status-fade-out");
  setTimeout(() => {
    statusEl.innerHTML = "";
    statusEl.className = "status-message";
    statusEl.classList.remove("status-fade-out");
  }, 250);
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains("toast-exit")) return;
  toast.classList.remove("toast-enter");
  toast.classList.add("toast-exit");
  setTimeout(() => {
    if (toast && toast.parentNode) toast.remove();
  }, 250);
}

// Estimates the real gas needed before sending, so public RPC nodes do not reject a huge default limit.
async function sendWithEstimatedGas(transaction, options = {}) {
  const gasNeeded = await transaction.estimateGas(options);
  return transaction.send({ ...options, gas: gasNeeded });
}

// Reads one event from a transaction receipt without crashing if the RPC did not decode it.
function getEventReturnValues(receipt, eventName) {
  const event = receipt && receipt.events && receipt.events[eventName];
  const eventRecord = Array.isArray(event) ? event[0] : event;
  return eventRecord && eventRecord.returnValues ? eventRecord.returnValues : null;
}

// Reads error messages even when a public RPC hides them inside nested objects.
function collectErrorText(value, seen = []) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object" || seen.includes(value)) return "";

  // Error.message is often hidden from Object.keys(), especially in Web3 errors.
  if (value instanceof Error) {
    return [value.message, value.reason, collectErrorText(value.data, seen)]
      .filter(Boolean)
      .join(" ");
  }

  seen.push(value);
  return Object.keys(value)
    .map((key) => collectErrorText(value[key], seen))
    .filter(Boolean)
    .join(" ");
}

// Turns long MetaMask and Solidity errors into a useful next step for the user.
function getFriendlyError(error, action) {
  // Some Web3 providers hide the Solidity reason inside nested error data.
  const raw = (String(error) + " " + collectErrorText(error)).toLowerCase();
  const actionName = String(action || "This action");

  if (raw.includes("user denied") || raw.includes("user rejected") || raw.includes("4001")) {
    return "Transaction cancelled in MetaMask. Nothing was changed.";
  }
  if (raw.includes("isaddress is not a function")) {
    return "The wallet connection library did not load correctly. Refresh the page and try again.";
  }
  if (raw.includes("invalid number") || raw.includes("invalid address") || raw.includes("invalid value")) {
    return "One of the form values is not valid. Check the Carrier address, amount, and milestone fields.";
  }
  if (raw.includes("gas limit too high") || raw.includes("exceeds the block gas limit")) {
    return "The network rejected this transaction because its gas limit was too high. Please try again.";
  }
  if (raw.includes("contract is not deployed") || raw.includes("returned values aren't valid") || raw.includes("returned values are not valid")) {
    return "The escrow contract cannot be read on this network. Switch MetaMask to the network where the contract was deployed.";
  }
  if (raw.includes("nonce too low") || raw.includes("transaction underpriced") || raw.includes("replacement transaction underpriced")) {
    return "This wallet has another pending transaction. Wait for it to finish, then try again.";
  }
  if (raw.includes("already known")) {
    return "This transaction was already submitted. Wait for MetaMask to finish, then refresh the page.";
  }
  if (raw.includes("failed to fetch") || raw.includes("network request failed") || raw.includes("could not connect") || raw.includes("connection refused")) {
    return "The blockchain network could not be reached. Check your internet connection and try again.";
  }
  if (raw.includes("timed out") || raw.includes("timeout")) {
    return "The network took too long to respond. Check MetaMask activity before trying again.";
  }
  if (raw.includes("out of gas") || raw.includes("gas required exceeds allowance")) {
    return "The transaction used more gas than the network allowed. Check the agreement status and try again.";
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
    const lowerActionName = actionName.toLowerCase();
    if (lowerActionName.includes("submit")) {
      return "This agreement is past its deadline, so no more milestones can be submitted.";
    }
    if (lowerActionName.includes("fund")) {
      return "This agreement is past its deadline, so it cannot be funded.";
    }
    if (lowerActionName.includes("verif")) {
      return "This agreement is past its deadline, so the milestone cannot be verified.";
    }
    return "This agreement is past its deadline, so no more milestone actions are allowed.";
  }
  if (raw.includes("deadline must be in the future")) {
    return "The deadline must be later than the current blockchain time. Increase it and try again.";
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
  if (raw.includes("role must be shipper or carrier")) {
    return "Please choose either the Shipper or Carrier role.";
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
  if (raw.includes("payout percentages do not match")) {
    return "The payout information does not match the number of milestones. Check the form and try again.";
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
  if (raw.includes("agreement already accepted")) {
    return "This agreement has already been accepted.";
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
  if (raw.includes("only a funded agreement can be refunded")) {
    return "This agreement is not ready for a refund. It must be funded and past its deadline.";
  }
  if (raw.includes("milestone does not exist")) {
    return "This milestone could not be found. Please refresh the page and choose the agreement again.";
  }
  if (raw.includes("payout transfer failed")) {
    return "The milestone was verified, but the payment could not be sent. Please check the network and try again.";
  }
  if (raw.includes("refund transfer failed")) {
    return "The refund could not be sent. Please check the network and try again.";
  }
  if (raw.includes("insufficient funds") || raw.includes("insufficient balance")) {
    return "Your wallet does not have enough ETH to complete this transaction.";
  }
  if (raw.includes("network") || raw.includes("wrong chain") || raw.includes("chainid")) {
    return "MetaMask may be connected to the wrong network. Connect it to the network where this contract was deployed.";
  }
  if (raw.includes("execution reverted") || raw.includes("vm exception while processing transaction")) {
    return "The blockchain rejected this action. Check the agreement status and try again.";
  }
  return actionName + " could not be completed. Check the agreement status and try again.";
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

// Renders an animated, interactive Milestone Step Progression Tracker with Focus Card
function renderMilestoneStepTracker(containerOrId, agreementRecord, milestones, options = {}) {
  const container = typeof containerOrId === "string" ? document.getElementById(containerOrId) : containerOrId;
  if (!container) return;

  const role = options.role || "viewer"; // "carrier" | "shipper" | "viewer"
  const totalCount = Number(agreementRecord.milestoneCount || (milestones ? milestones.length : 0));
  if (!totalCount) {
    container.innerHTML = "";
    return;
  }

  const doneCount = Number(agreementRecord.milestonesDone || 0);
  const allCompleted = doneCount >= totalCount;

  const escape = (str) => typeof escapeHtmlForPage === "function" ? escapeHtmlForPage(str) : (str || "");

  // Build steps HTML
  let trackHtml = "";
  for (let i = 0; i < totalCount; i++) {
    const m = (milestones && milestones[i]) || {};
    const isComplete = i < doneCount;
    const isActive = !allCompleted && i === doneCount;

    let stepClass = "upcoming";
    let nodeContent = String(i + 1);
    let statusText = "Pending";

    if (isComplete) {
      stepClass = "complete";
      nodeContent = "✓";
      statusText = "Verified";
    } else if (isActive) {
      stepClass = "active";
      nodeContent = String(i + 1);
      statusText = m.submitted ? "Review" : "In Progress";
    }

    trackHtml += `
      <div class="stepper-step ${stepClass}">
        <div class="stepper-node">${nodeContent}</div>
        <div class="stepper-step-labels">
          <span class="stepper-step-name">${escape(m.name || ("Milestone " + (i + 1)))}</span>
          <span class="stepper-step-share">${m.payoutPercentage || 0}% · ${statusText}</span>
        </div>
      </div>
    `;
  }

  // Build Focus Card HTML
  let focusCardHtml = "";
  if (allCompleted) {
    focusCardHtml = `
      <div class="stepper-focus-card">
        <div class="focus-card-header">
          <h3 class="focus-card-title">🎉 All Milestones Completed & Verified!</h3>
          <span class="focus-card-payout">100% Escrow Released</span>
        </div>
        <p class="focus-card-desc">Every milestone in this agreement has been successfully submitted and verified. All escrow funds have been released to the Carrier.</p>
      </div>
    `;
  } else {
    const activeMilestone = (milestones && milestones[doneCount]) || {};
    let payoutEth = "0";
    try {
      if (typeof web3Client !== "undefined" && web3Client.utils) {
        const totalWei = BigInt(agreementRecord.declaredPayloadValue || agreementRecord.totalValue || "0");
        const share = BigInt(activeMilestone.payoutPercentage || 0);
        const payoutWei = (totalWei * share) / 100n;
        payoutEth = web3Client.utils.fromWei(payoutWei.toString(), "ether");
      }
    } catch (e) {
      payoutEth = "0";
    }

    let statusCalloutHtml = "";
    if (role === "carrier") {
      if (activeMilestone.submitted) {
        statusCalloutHtml = `
          <div class="focus-card-note-box">
            <div class="focus-card-note-label">
              <span>✓ Your Submitted Completion Note</span>
            </div>
            <p class="focus-card-note-text">"${escape(activeMilestone.submissionNote)}"</p>
          </div>
          <div class="focus-card-status-callout submitted">
            <span>⏳ Submitted to blockchain — Waiting for the Shipper to verify this milestone and release ${payoutEth} ETH.</span>
          </div>
        `;
      } else {
        statusCalloutHtml = `
          <div class="focus-card-status-callout pending">
            <span>📝 Ready for completion report — Fill in the note below and submit to request Shipper verification.</span>
          </div>
        `;
      }
    } else if (role === "shipper") {
      if (activeMilestone.submitted) {
        statusCalloutHtml = `
          <div class="focus-card-note-box">
            <div class="focus-card-note-label">
              <span>📋 Carrier Completion Note</span>
            </div>
            <p class="focus-card-note-text">"${escape(activeMilestone.submissionNote)}"</p>
          </div>
          <div class="focus-card-status-callout submitted">
            <span>🔔 Carrier has submitted this milestone! Review their note above and click "Verify and release" below to release ${payoutEth} ETH.</span>
          </div>
        `;
      } else {
        statusCalloutHtml = `
          <div class="focus-card-status-callout pending">
            <span>⏳ Awaiting Carrier submission — The Carrier has not submitted a completion note for this milestone yet.</span>
          </div>
        `;
      }
    } else {
      // Viewer
      if (activeMilestone.submitted) {
        statusCalloutHtml = `
          <div class="focus-card-note-box">
            <div class="focus-card-note-label">
              <span>Carrier Note</span>
            </div>
            <p class="focus-card-note-text">"${escape(activeMilestone.submissionNote)}"</p>
          </div>
          <div class="focus-card-status-callout submitted">
            <span>Submitted — Waiting for Shipper review.</span>
          </div>
        `;
      } else {
        statusCalloutHtml = `
          <div class="focus-card-status-callout pending">
            <span>Pending carrier completion.</span>
          </div>
        `;
      }
    }

    focusCardHtml = `
      <div class="stepper-focus-card">
        <div class="focus-card-header">
          <h3 class="focus-card-title">Step ${doneCount + 1} of ${totalCount}: ${escape(activeMilestone.name || ("Milestone " + (doneCount + 1)))}</h3>
          <span class="focus-card-payout">💰 Payout: ${activeMilestone.payoutPercentage || 0}% (${payoutEth} ETH)</span>
        </div>
        <p class="focus-card-desc">${escape(activeMilestone.description || "No description provided.")}</p>
        ${statusCalloutHtml}
      </div>
    `;
  }

  const badgeText = allCompleted
    ? "All Steps Complete ✓"
    : `Active: Step ${doneCount + 1} of ${totalCount}`;

  container.innerHTML = `
    <div class="milestone-stepper-wrap">
      <div class="stepper-header-strip">
        <div class="stepper-title-area">
          <h4 class="stepper-heading">Milestone Progression Tracker</h4>
          <span class="stepper-status-badge">${badgeText}</span>
        </div>
      </div>
      <div class="stepper-track">
        ${trackHtml}
      </div>
      ${focusCardHtml}
    </div>
  `;
}

// Copies text to clipboard with instant visual feedback and a toast notification.
async function copyTextToClipboard(text, label = "Wallet address", buttonElement = null) {
  if (!text) {
    showStatusMessage("No text available to copy.", "warning");
    return false;
  }

  let success = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      success = true;
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      success = document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  } catch (err) {
    console.warn("Clipboard API failed, trying execCommand fallback:", err);
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      success = document.execCommand("copy");
      document.body.removeChild(textarea);
    } catch (e2) {
      console.error("Copy failed completely:", e2);
    }
  }

  if (success) {
    const btn = buttonElement || (typeof event !== "undefined" && event && event.currentTarget) || document.getElementById("copyAddressBtn");
    if (btn) {
      const originalHtml = btn.dataset.originalContent || btn.innerHTML;
      btn.dataset.originalContent = originalHtml;
      btn.innerHTML = "<span class='copy-icon' aria-hidden='true'>✓</span><span class='copy-label'>Copied!</span>";
      btn.classList.add("copied");
      setTimeout(() => {
        if (btn) {
          btn.innerHTML = originalHtml;
          btn.classList.remove("copied");
        }
      }, 2000);
    }
    showStatusMessage(label + " copied to clipboard!", "success");
    return true;
  } else {
    showStatusMessage("Could not copy to clipboard. Please copy manually.", "error");
    return false;
  }
}
