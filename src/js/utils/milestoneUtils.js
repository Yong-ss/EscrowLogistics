// Creates one name and description form for each milestone count.
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
        </div>
      </div>`;
  }
};

// Reads the milestone form values before sending them to the contract.
const getMilestoneInputs = () => ({
  names: Array.from(document.querySelectorAll("[name='milestoneName']")).map((input) => input.value.trim()),
  descriptions: Array.from(document.querySelectorAll("[name='milestoneDescription']")).map((input) => input.value.trim()),
});

// Render the default milestone fields as soon as the create page is ready.
document.addEventListener("DOMContentLoaded", () => {
  const countInput = document.getElementById("milestoneCount");
  if (!countInput) return;
  countInput.addEventListener("change", renderMilestoneInputs);
  renderMilestoneInputs();
});
