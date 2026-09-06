// Creates one simple plan form for each milestone, including its payout share.
const renderMilestoneInputs = () => {
  const container = document.getElementById("milestoneInputs");
  const count = Math.max(1, Number(document.getElementById("milestoneCount").value) || 1);

  // Rebuild the list when the Shipper changes the number of milestones.
  container.innerHTML = "";
  for (let index = 0; index < count; index++) {
    container.innerHTML += `
      <div class="milestone-input">
        <h3>Milestone ${index + 1}</h3>
        <div class="form-grid">
          <div class="field">
            <label for="milestoneName${index}">Name</label>
            <input id="milestoneName${index}" name="milestoneName" required placeholder="e.g. Pickup from warehouse" />
          </div>
          <div class="field">
            <label for="milestoneDescription${index}">Description</label>
            <input id="milestoneDescription${index}" name="milestoneDescription" required placeholder="What must be completed?" />
          </div>
          <div class="field">
            <label for="milestonePercentage${index}">Payout share (%)</label>
            <input id="milestonePercentage${index}" name="milestonePercentage" type="number" min="1" max="100" value="${Math.floor(100 / count) + (index < 100 % count ? 1 : 0)}" required />
          </div>
        </div>
        <p class="milestone-payout-preview" id="milestonePayoutPreview${index}"></p>
      </div>`;
  }
  updateMilestonePayoutPreview();
};

// Shows the actual ETH amount that this milestone will release after verification.
const updateMilestonePayoutPreview = () => {
  const payloadInput = document.getElementById("payloadValue");
  const payloadValue = Number(payloadInput ? payloadInput.value : 0) || 0;
  document.querySelectorAll("[name='milestonePercentage']").forEach((input, index) => {
    const preview = document.getElementById("milestonePayoutPreview" + index);
    if (preview) preview.textContent = (payloadValue * Number(input.value || 0) / 100).toFixed(4) + " ETH released after verification";
  });
};

// Reads the complete milestone plan before sending it to the contract.
const getMilestoneInputs = () => ({
  names: Array.from(document.querySelectorAll("[name='milestoneName']")).map((input) => input.value.trim()),
  descriptions: Array.from(document.querySelectorAll("[name='milestoneDescription']")).map((input) => input.value.trim()),
  payoutPercentages: Array.from(document.querySelectorAll("[name='milestonePercentage']")).map((input) => Number(input.value)),
});

// Render the default milestone fields as soon as the create page is ready.
document.addEventListener("DOMContentLoaded", () => {
  const countInput = document.getElementById("milestoneCount");
  if (!countInput) return;
  countInput.addEventListener("change", renderMilestoneInputs);
  const payloadInput = document.getElementById("payloadValue");
  if (payloadInput) payloadInput.addEventListener("input", updateMilestonePayoutPreview);
  document.addEventListener("input", (event) => {
    if (event.target.matches("[name='milestonePercentage']")) updateMilestonePayoutPreview();
  });
  renderMilestoneInputs();
});
