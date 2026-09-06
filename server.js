// Minimal Express server that serves the dApp frontend (Lab 8.1 style).
const express = require("express");
const path = require("path");
const app = express();

// Serve all HTML, CSS, and JavaScript files from the frontend folder.
app.use(express.static(path.join(__dirname, "src")));

// Open the dashboard when someone visits the site's root URL.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "src", "index.html"));
});

const PORT = 5000;
// Start the small local server used to open the dApp in a browser.
app.listen(PORT, () => {
  console.log("Escrow Logistics dApp running on http://localhost:" + PORT);
});
