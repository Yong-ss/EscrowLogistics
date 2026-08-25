# Escrow Logistics dApp — Installation & Setup Guide

Decentralized Escrow and Milestone-Based Logistics Platform.
Built with Solidity `^0.8.0`, Remix / Truffle, Ganache, MetaMask, and a plain
HTML + web3.js frontend served by a Node.js Express server.

---

## Prerequisites

Install these first (the same tools used in the course labs):

- **Node.js** (LTS) — includes `npm`
- **Ganache** (GUI) — local Ethereum blockchain — https://trufflesuite.com/ganache/
- **MetaMask** browser extension — https://metamask.io/
- **Truffle** (optional, for CLI deploy): `npm install -g truffle`
- **Remix IDE** (optional, browser alternative for deploy): https://remix.ethereum.org/

---

## Project structure

```
EscrowLogistics/
├── contracts/
│   ├── EscrowLogistics.sol      # main smart contract
│   └── Migrations.sol           # Truffle migrations helper
├── migrations/
│   ├── 1_initial_migration.js
│   └── 2_deploy_contracts.js
├── src/                         # frontend (served by Express)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── abi.js               # contract address + ABI (paste address after deploy)
│       ├── utils/                # shared helpers, no contract logic
│       │   ├── formatUtils.js    # Wei/Ether conversion, role/status names, event cleanup
│       │   └── domUtils.js       # show/hide a panel, show a status message
│       ├── services/             # connects to MetaMask + the contract
│       │   ├── walletConnection.js
│       │   └── contractConnection.js
│       └── controllers/          # one file per section of the page
│           ├── pageController.js       # shows the right section for the connected role
│           ├── registerController.js   # register as Shipper/Carrier
│           ├── shipperController.js    # create/fund/verify/refund
│           ├── carrierController.js    # carrier dashboard + job list
│           └── agreementController.js # agreement details + event history
├── server.js                    # Express static server (port 5000)
├── truffle-config.js
└── package.json
```

---

## Step 1 — Start Ganache

Open Ganache and start a workspace (Quickstart is fine). Note the RPC server,
default `HTTP://127.0.0.1:7545`, and Chain ID `1337`.

## Step 2 — Deploy the contract

**Option A — Remix (simplest, Lab 8.1):**
1. Open https://remix.ethereum.org and create `EscrowLogistics.sol`, paste the
   contract from `contracts/EscrowLogistics.sol`.
2. Compile with compiler `0.8.19`.
3. In *Deploy & Run*, set environment to **Dev - Ganache Provider** and point it
   at `http://127.0.0.1:7545`.
4. Deploy, then **copy the deployed contract address**.

**Option B — Truffle (Lab 8.2):**
```bash
truffle compile
truffle migrate --network development
```
Copy the deployed `EscrowLogistics` address from the migration output.

## Step 3 — Configure the frontend

Open `src/js/abi.js` and paste the deployed address:
```js
const CONTRACT_ADDRESS = "0xYourDeployedAddressHere";
```
The ABI is already filled in — no other change needed.

## Step 4 — Connect MetaMask to Ganache

1. In MetaMask, add a network: RPC `http://127.0.0.1:7545`, Chain ID `1337`.
2. Import a Ganache account using its private key (click the key icon in Ganache).
   Import **two** accounts so you can act as both Shipper and Carrier.

## Step 5 — Run the frontend

```bash
npm install
npm start
```
Open http://localhost:5000 in the browser with MetaMask installed.

---

## How to use (demo flow)

1. **Connect MetaMask** — click *Connect MetaMask*.
2. **Register** — with the Shipper account click *Register as Shipper*; switch the
   MetaMask account to the Carrier and click *Register as Carrier*.
3. **Create Agreement** — as the Shipper, enter the Carrier's address, milestone
   count (e.g. 3) and a deadline, then *Create Agreement* (note the new ID).
4. **Fund Escrow** — as the Shipper, fund the agreement with e.g. 3 ETH.
5. **Verify Milestone** — as the Shipper, click *Verify Next Milestone*; each
   verification releases an even share (e.g. 1 ETH) to the Carrier and awards
   +1 reputation. After the last milestone the agreement becomes *Completed*.
6. **Refund** — if the deadline passes before completion, click *Trigger Refund*
   to return the unreleased balance to the Shipper.
7. **Agreement Details / Transaction History** — load an agreement's state and
   view the event history at any time.

---

## Notes

- All Ether amounts in the UI are entered in **Ether** and converted to Wei
  automatically (`web3.utils.toWei`).
- Payout per milestone = `totalValue / milestoneCount`; the final milestone pays
  the remainder so no funds are stuck.
- Transaction history is reconstructed from the contract's emitted **events**.
