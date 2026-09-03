const toggleSidebar = () => document.body.classList.toggle("sidebar-open");

const applyRoleLayout = (roleNumber) => {
  const roleName = ROLE_NAMES[roleNumber] || "Guest";
  document.body.dataset.role = roleName.toLowerCase();
  document.querySelectorAll("[data-role]").forEach((element) => {
    const allowed = element.dataset.role.split(" ").includes(roleName.toLowerCase());
    element.classList.toggle("role-hidden", !allowed);
  });
};
