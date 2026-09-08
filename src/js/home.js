// Open onboarding immediately, even in a browser without a wallet extension.
document.querySelectorAll('[data-connect]').forEach((button) => {
  button.addEventListener('click', () => window.location.assign('portal.html'));
});
