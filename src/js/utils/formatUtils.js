// Lookup tables + small formatting helpers shared by every controller.

const ROLE_NAMES = ["None", "Shipper", "Carrier"];
const STATUS_NAMES = ["Created", "Funded", "Completed", "Refunded"];

// shorten an address for table display, e.g. 0xdF61...6ee8
function shortenAddress(address) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

// keep only the named keys from a web3 returnValues object (drop numeric duplicates)
function cleanEventValues(returnValues) {
  const cleanedValues = {};
  Object.keys(returnValues).forEach((key) => {
    if (isNaN(key)) cleanedValues[key] = returnValues[key];
  });
  return cleanedValues;
}
