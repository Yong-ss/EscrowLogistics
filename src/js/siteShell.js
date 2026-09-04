// Opens or closes the sidebar on small screens.
const toggleSidebar = () => document.body.classList.toggle("sidebar-open");

// Loads the same sidebar, header, and footer into every page.
const loadSharedPartials = async () => {
  const placeholders = document.querySelectorAll("[data-include]");

  await Promise.all(
    Array.from(placeholders).map(async (placeholder) => {
      const response = await fetch(placeholder.dataset.include);
      placeholder.outerHTML = await response.text();
    })
  );

  // Hide role-only content first, before checking MetaMask.
  // This prevents Shipper and Carrier tools flashing for unregistered users.
  applyRoleLayout(0);

  const titleElement = document.querySelector("[data-page-title]");
  if (titleElement && document.body.dataset.title) {
    titleElement.textContent = document.body.dataset.title;
  }

  const activeLink = document.querySelector(`[data-page-link="${document.body.dataset.page}"]`);
  if (activeLink) activeLink.classList.add("active");

  // Reuse the same registered wallet on every page without asking MetaMask again.
  if (typeof restoreWalletConnection === "function") await restoreWalletConnection();
};

// Hides menu items that do not belong to the connected wallet's role.
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
    showFriendlyError(error, "Loading the page");
  });
});
