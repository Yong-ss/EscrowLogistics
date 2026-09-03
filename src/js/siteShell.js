const toggleSidebar = () => document.body.classList.toggle("sidebar-open");

const loadSharedPartials = async () => {
  const placeholders = document.querySelectorAll("[data-include]");

  await Promise.all(
    Array.from(placeholders).map(async (placeholder) => {
      const response = await fetch(placeholder.dataset.include);
      placeholder.outerHTML = await response.text();
    })
  );

  const titleElement = document.querySelector("[data-page-title]");
  if (titleElement && document.body.dataset.title) {
    titleElement.textContent = document.body.dataset.title;
  }

  const activeLink = document.querySelector(`[data-page-link="${document.body.dataset.page}"]`);
  if (activeLink) activeLink.classList.add("active");
};

const applyRoleLayout = (roleNumber) => {
  const roleName = ROLE_NAMES[roleNumber] || "Guest";
  document.body.dataset.role = roleName.toLowerCase();
  document.querySelectorAll("[data-role]").forEach((element) => {
    const allowed = element.dataset.role.split(" ").includes(roleName.toLowerCase());
    element.classList.toggle("role-hidden", !allowed);
  });
};

document.addEventListener("DOMContentLoaded", () => {
  loadSharedPartials().catch((error) => {
    showStatusMessage("Page layout failed: " + error.message);
  });
});
