// Small helpers for updating the page - no contract logic here.

function showStatusMessage(message) {
  const status = document.getElementById("status");
  if (status) status.innerHTML = message;
}

function showPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.remove("hidden");
}

function hidePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add("hidden");
}
