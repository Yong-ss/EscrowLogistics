// Small helpers for updating the page - no contract logic here.

function showStatusMessage(message) {
  document.getElementById("status").innerHTML = message;
}

function showPanel(panelId) {
  document.getElementById(panelId).classList.remove("hidden");
}

function hidePanel(panelId) {
  document.getElementById(panelId).classList.add("hidden");
}
