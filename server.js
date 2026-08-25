// Minimal Express server that serves the dApp frontend (Lab 8.1 style).
const express = require("express");
const path = require("path");
const app = express();

// serve static assets (js, css) from the src folder
app.use(express.static(path.join(__dirname, "src")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "src", "index.html"));
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log("Escrow Logistics dApp running on http://localhost:" + PORT);
});
