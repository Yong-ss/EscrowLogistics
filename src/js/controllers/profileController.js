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
  const removeButton = document.getElementById("removeAvatarButton");
  if (removeButton) removeButton.disabled = !enabled || !selectedAvatarData;
  document.getElementById("avatarDropzone")?.classList.toggle("is-disabled", !enabled);
};

// Shows the local photo when available, otherwise shows the user's initials.
const updateProfileAvatar = () => {
  const nameInput = document.getElementById("profileName");
  const initials = document.getElementById("profileInitials");
  const image = document.getElementById("profileAvatar");
  const removeButton = document.getElementById("removeAvatarButton");
  if (!nameInput || !initials || !image) return;

  initials.textContent = getProfileInitials(nameInput.value);
  const hasPhoto = Boolean(selectedAvatarData);
  initials.classList.toggle("hidden", hasPhoto);
  image.classList.toggle("hidden", !hasPhoto);
  if (hasPhoto) {
    image.src = selectedAvatarData;
  } else {
    image.removeAttribute("src");
  }
  if (removeButton) {
    removeButton.classList.toggle("hidden", !hasPhoto);
    removeButton.disabled = !hasPhoto || nameInput.disabled;
  }
};

// Updates the wallet address and role labels shown beside the profile form.
const updateProfileIdentity = () => {
  const account = document.getElementById("profileAccount");
  const role = document.getElementById("profileRole");
  const copyBtn = document.getElementById("copyAddressBtn");
  const hashBadge = document.getElementById("addressHashBadge");
  const helpText = document.getElementById("walletAddressHelp");

  if (account) {
    if (connectedAccount) {
      const isFull = account.getAttribute("data-show-full") === "true";
      const displayHash = typeof formatAddressHash === "function"
        ? formatAddressHash(connectedAccount)
        : (typeof shortenAddress === "function" ? shortenAddress(connectedAccount) : connectedAccount);
      account.textContent = isFull ? connectedAccount : displayHash;
      account.setAttribute("data-full-address", connectedAccount);
      account.title = "Full address: " + connectedAccount + " (Click to toggle hash / full)";
      account.classList.add("is-connected");
      if (hashBadge) {
        hashBadge.textContent = isFull ? "FULL" : "HASH";
        hashBadge.classList.remove("hidden");
      }
      if (helpText) helpText.textContent = "Hashed on-chain address. Click address to toggle, or copy at right.";
      if (copyBtn) {
        copyBtn.disabled = false;
        copyBtn.title = "Copy full address (" + connectedAccount + ")";
      }
    } else {
      account.textContent = "Wallet not connected";
      account.removeAttribute("data-full-address");
      account.removeAttribute("data-show-full");
      account.title = "Please connect your MetaMask wallet";
      account.classList.remove("is-connected");
      if (hashBadge) hashBadge.classList.add("hidden");
      if (helpText) helpText.textContent = "Connected Web3 address formatted as on-chain hash.";
      if (copyBtn) {
        copyBtn.disabled = true;
        copyBtn.title = "Connect wallet first to copy";
      }
    }
  }

  if (role) {
    let roleNumber = 0;
    if (document.body.dataset.role === "shipper") roleNumber = 1;
    else if (document.body.dataset.role === "carrier") roleNumber = 2;
    role.textContent = ROLE_NAMES[roleNumber] || "Not registered";
    role.className = "status-pill " + (roleNumber === 1 ? "status-funded" : (roleNumber === 2 ? "status-waiting" : "status-refunded"));
  }
};

// Loads the profile belonging to the current wallet and current blockchain network.
const loadProfilePage = async () => {
  updateProfileIdentity();
  if (!connectedAccount || !web3Client) {
    setProfileFormEnabled(false);
    if (!connectedAccount) {
      showStatusMessage("Connect your wallet before editing your profile.", "warning");
    }
    return;
  }

  // Check on-chain role directly to update role badge immediately
  if (escrowContract && connectedAccount) {
    try {
      const currentUserRole = Number(await escrowContract.methods.roles(connectedAccount).call());
      const role = document.getElementById("profileRole");
      if (role) {
        role.textContent = ROLE_NAMES[currentUserRole] || "Not registered";
        role.className = "status-pill " + (currentUserRole === 1 ? "status-funded" : (currentUserRole === 2 ? "status-waiting" : "status-refunded"));
      }
    } catch (e) {
      console.warn("Could not query role for profile:", e);
    }
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
    const hint = document.getElementById("avatarUploadHint");
    if (hint) {
      hint.textContent = selectedAvatarData ? "Photo uploaded. Drop or browse to replace." : "PNG, JPG, GIF, or WEBP up to 1 MB";
    }
  } catch (error) {
    setProfileFormEnabled(false);
    showFriendlyError(error, "Loading your profile");
  }
};

// Saves the form locally without adding personal contact data to the public blockchain.
const saveProfileForm = async (event) => {
  event.preventDefault();
  if (!connectedAccount || !web3Client || !profileChainId) {
    showStatusMessage("Connect your wallet before saving your profile.", "warning");
    return;
  }

  const name = document.getElementById("profileName").value.trim();
  const emailInput = document.getElementById("profileEmail");
  if (!name) {
    showStatusMessage("Please enter your name.", "required");
    return;
  }
  if (emailInput.value && !emailInput.checkValidity()) {
    showStatusMessage("Please enter a valid email address.", "required");
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
    showStatusMessage("Profile saved on this browser.", "success");
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
    showStatusMessage("Please choose an image smaller than 1 MB.", "warning");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    if (!isSafeAvatarData(reader.result)) {
      input.value = "";
      showStatusMessage("Please choose a PNG, JPG, GIF, or WEBP image.", "warning");
      return;
    }
    selectedAvatarData = reader.result;
    updateProfileAvatar();
    const hint = document.getElementById("avatarUploadHint");
    if (hint) hint.textContent = "Selected: " + (file.name || "image file");
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
  const hint = document.getElementById("avatarUploadHint");
  if (hint) hint.textContent = "PNG, JPG, GIF, or WEBP up to 1 MB";
  showStatusMessage("Profile photo removed. Click 'Save profile' to persist.", "info");
};

document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("profileName");
  const avatarInput = document.getElementById("profileAvatarInput");
  if (nameInput) nameInput.addEventListener("input", updateProfileAvatar);
  if (avatarInput) avatarInput.addEventListener("change", () => handleProfileAvatarChange(avatarInput));

  const dropzone = document.getElementById("avatarDropzone");
  if (dropzone && avatarInput) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!avatarInput.disabled) dropzone.classList.add("drag-active");
      });
    });

    ["dragleave", "dragend"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("drag-active");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("drag-active");
      if (avatarInput.disabled) return;
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        avatarInput.files = dt.files;
        handleProfileAvatarChange(avatarInput);
      }
    });
  }

  updateProfileIdentity();
});
