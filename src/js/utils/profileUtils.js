// Small browser-only helpers for saving profile details per wallet and network.

const PROFILE_STORAGE_PREFIX = "escrowProfile";

// Keeps Shipper and Carrier profiles separate, even when the same wallet is used on two networks.
function getProfileStorageKey(chainId, address) {
  return PROFILE_STORAGE_PREFIX + ":" + String(chainId) + ":" + String(address).toLowerCase();
}

// Only allow image formats that can safely be shown as a local data URL.
function isSafeAvatarData(value) {
  return typeof value === "string" && (
    value === "" || /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/]+=*$/i.test(value)
  );
}

// Removes unexpected values before profile data is written back to the browser.
function cleanProfileData(profile) {
  const source = profile && typeof profile === "object" ? profile : {};
  return {
    name: typeof source.name === "string" ? source.name.trim().slice(0, 80) : "",
    email: typeof source.email === "string" ? source.email.trim().slice(0, 120) : "",
    phone: typeof source.phone === "string" ? source.phone.trim().slice(0, 40) : "",
    avatar: isSafeAvatarData(source.avatar) ? source.avatar : "",
  };
}

// Reads a saved profile without allowing broken JSON to break the page.
function loadSavedProfile(storage, chainId, address) {
  try {
    const saved = storage.getItem(getProfileStorageKey(chainId, address));
    return saved ? cleanProfileData(JSON.parse(saved)) : null;
  } catch (error) {
    return null;
  }
}

// Saves only local profile details; the blockchain role remains the source of truth for identity.
function saveProfile(storage, chainId, address, profile) {
  const cleanProfile = cleanProfileData(profile);
  storage.setItem(getProfileStorageKey(chainId, address), JSON.stringify(cleanProfile));
  return cleanProfile;
}

// Creates a simple avatar fallback from the user's name.
function getProfileInitials(name) {
  const words = String(name || "User").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "U";
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}
