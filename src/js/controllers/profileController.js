// Profile page - stores simple contact details locally for the connected wallet.

const PROFILE_AVATAR_LIMIT = 1024 * 1024;
let profileChainId;
let selectedAvatarData = "";

// Enables or disables editable profile controls until a wallet is connected.
const setProfileFormEnabled = (enabled) => {
  const form = document.getElementById("profileForm");
  if (!form) return;
  form.querySelectorAll("input, button").forEach((element) => {
    element.disabled = !enabled;
  });
};

// Shows the local photo when available, otherwise shows the user's initials.
const updateProfileAvatar = () => {
  const nameInput = document.getElementById("profileName");
  const initials = document.getElementById("profileInitials");
  const image = document.getElementById("profileAvatar");
  if (!nameInput || !initials || !image) return;

  initials.textContent = getProfileInitials(nameInput.value);
  const hasPhoto = Boolean(selectedAvatarData);
  initials.classList.toggle("hidden", hasPhoto);
  image.classList.toggle("hidden", !hasPhoto);
  if (hasPhoto) image.src = selectedAvatarData;
};

// Updates the wallet and role labels shown beside the profile form.
const updateProfileIdentity = () => {
  const account = document.getElementById("profileAccount");
  const role = document.getElementById("profileRole");
  if (account) account.textContent = connectedAccount || "Wallet not connected";
  if (role) {
    const roleNumber = document.body.dataset.role === "shipper" ? 1 :
      document.body.dataset.role === "carrier" ? 2 : 0;
    role.textContent = ROLE_NAMES[roleNumber] || "Not registered";
  }
};

// Loads the profile belonging to the current wallet and current blockchain network.
const loadProfilePage = async () => {
  updateProfileIdentity();
  if (!connectedAccount || !web3Client) {
    setProfileFormEnabled(false);
    showStatusMessage("Connect your wallet before editing your profile.", "error");
    return;
  }

  try {
    profileChainId = await web3Client.eth.getChainId();
    const savedProfile = loadSavedProfile(localStorage, profileChainId, connectedAccount) || {};
    document.getElementById("profileName").value = savedProfile.name || "";
    document.getElementById("profileEmail").value = savedProfile.email || "";
    document.getElementById("profilePhone").value = savedProfile.phone || "";
    document.getElementById("profileDisplayName").textContent = savedProfile.name || "Your profile";
    selectedAvatarData = savedProfile.avatar || "";
    setProfileFormEnabled(true);
    updateProfileAvatar();
    showStatusMessage("Profile loaded for this wallet.");
  } catch (error) {
    setProfileFormEnabled(false);
    showFriendlyError(error, "Loading your profile");
  }
};

// Saves the form locally without adding personal contact data to the public blockchain.
const saveProfileForm = async (event) => {
  event.preventDefault();
  if (!connectedAccount || !web3Client || !profileChainId) {
    showStatusMessage("Connect your wallet before saving your profile.", "error");
    return;
  }

  const name = document.getElementById("profileName").value.trim();
  const emailInput = document.getElementById("profileEmail");
  if (!name) {
    showStatusMessage("Please enter your name.", "error");
    return;
  }
  if (emailInput.value && !emailInput.checkValidity()) {
    showStatusMessage("Please enter a valid email address.", "error");
    return;
  }

  try {
    saveProfile(localStorage, profileChainId, connectedAccount, {
      name,
      email: emailInput.value,
      phone: document.getElementById("profilePhone").value,
      avatar: selectedAvatarData,
    });
    document.getElementById("profileDisplayName").textContent = name;
    updateProfileAvatar();
    if (typeof updateWalletHeader === "function") updateWalletHeader();
    showStatusMessage("Profile saved on this browser.");
  } catch (error) {
    showFriendlyError(error, "Saving your profile");
  }
};

// Reads a small local image for the avatar preview; large files stay out of localStorage.
const handleProfileAvatarChange = (input) => {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > PROFILE_AVATAR_LIMIT) {
    input.value = "";
    showStatusMessage("Please choose an image smaller than 1 MB.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    if (!isSafeAvatarData(reader.result)) {
      input.value = "";
      showStatusMessage("Please choose a PNG, JPG, GIF, or WEBP image.", "error");
      return;
    }
    selectedAvatarData = reader.result;
    updateProfileAvatar();
  };
  reader.onerror = () => showStatusMessage("The image could not be loaded. Please choose another file.", "error");
  reader.readAsDataURL(file);
};

// Removes the local avatar and returns to the initials fallback.
const removeProfileAvatar = () => {
  const input = document.getElementById("profileAvatarInput");
  if (input) input.value = "";
  selectedAvatarData = "";
  updateProfileAvatar();
};

document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("profileName");
  const avatarInput = document.getElementById("profileAvatarInput");
  if (nameInput) nameInput.addEventListener("input", updateProfileAvatar);
  if (avatarInput) avatarInput.addEventListener("change", () => handleProfileAvatarChange(avatarInput));
});
