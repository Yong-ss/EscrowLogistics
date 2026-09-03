// Small helpers for updating the page - no contract logic here.

// Shows a small success or error message when a page has a status area.
function showStatusMessage(message) {
  const status = document.getElementById("status");
  if (status) status.innerHTML = message;
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
