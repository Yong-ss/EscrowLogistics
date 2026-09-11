# Escrow Logistics dApp

Decentralized escrow and milestone-based logistics platform built with Solidity, Truffle, Ganache, MetaMask, Web3.js, and a plain HTML/CSS/JavaScript frontend.

GitHub repository: [EscrowLogistics](https://github.com/Yong-ss/EscrowLogistics)

## What the dApp does

- Users connect a MetaMask wallet and register as either a Shipper or Carrier.
- A Shipper creates a named logistics agreement for a registered Carrier.
- The agreement stores milestone names, descriptions, deadlines, and payout percentages.
- The Carrier accepts the agreement before the Shipper funds it.
- The Shipper locks the exact declared Ether amount in the escrow contract.
- The Carrier submits a completion note for each milestone.
- The Shipper verifies each milestone and the agreed percentage is paid automatically to the Carrier.
- If the funded agreement passes its deadline before completion, anyone can trigger a refund of the unreleased balance to the Shipper.
- Agreement details and chronological blockchain events can be viewed from the agreement list.
- A simple Profile page stores a name, email, contact number, and optional avatar in the current browser only. The wallet role remains on-chain.

## Main technology

- Solidity `0.8.19`
- Truffle for compiling, testing, and deploying
- Ganache for local blockchain testing
- Sepolia for shared public test-network deployment
- MetaMask and Web3.js for wallet and contract interaction
- Node.js and Express for serving the frontend

## Project structure

```text
EscrowLogistics/
├── assets/                         # Source 3D model, logos, and material textures
├── contracts/                      # Solidity smart contracts
├── migrations/                     # Truffle deployment scripts
├── src/
│   ├── assets/                     # Frontend copies of images, model, and textures
│   ├── *.html                      # Application pages (dashboard, portal, agreements, jobs, profile, etc.)
│   ├── css/                        # Shared, landing-page, and portal styles
│   ├── js/
│   │   ├── abi.js                  # Contract ABI and deployed address
│   │   ├── home.js                 # Landing page initialization
│   │   ├── homeMotion.js            # Landing page motion
│   │   ├── truckScene.js            # Three.js logistics truck scene
│   │   ├── controllers/             # Page, role, agreement, profile, and operation controllers
│   │   ├── services/                # MetaMask and smart-contract connections
│   │   ├── utils/                   # Formatting, DOM, milestone, and profile helpers
│   │   └── vendor/                  # Three.js and model-loader libraries
│   └── partials/                    # Shared header, sidebar, and footer
├── package.json                    # Project scripts and dependencies
├── README.md                       # Project description and setup instructions
├── server.js                       # Express static server
└── truffle-config.js               # Ganache and Sepolia network settings
```
## Run the existing Sepolia deployment

This is the normal setup for using the shared dApp. Users do not need Ganache, Truffle deployment, or a mnemonic.

### 1. Install dependencies

```bash
npm install
```

### 2. Check the contract address

Open `src/js/abi.js` and make sure `CONTRACT_ADDRESS` is the deployed Sepolia address. The ABI in the same file must match that contract.

### 3. Start the website

```bash
npm start
```

Open [http://localhost:5000](http://localhost:5000), install MetaMask, switch MetaMask to Sepolia, and use a wallet with Sepolia test ETH for gas.

Different users can use different MetaMask accounts while sharing the same Sepolia contract address.

## Deploy a new contract to Sepolia

Only do this after changing the Solidity contract, or when creating a separate deployment. Use a dedicated Sepolia test wallet and never use or share a real wallet recovery phrase.

In PowerShell, set the mnemonic only for the current terminal:

```powershell
$env:SEPOLIA_MNEMONIC = "YOUR_DEDICATED_TEST_WALLET_MNEMONIC"
truffle compile
truffle migrate --network sepolia
```

After deployment:

1. Copy the new `EscrowLogistics` contract address into `src/js/abi.js`.
2. Replace the ABI too if the Solidity functions, events, parameters, or return values changed.
3. Restart the website with `npm start`.

Never commit `.env` files, mnemonics, private keys, or wallets containing real funds.

## Local Ganache development

Open Ganache on `http://127.0.0.1:7545`, then deploy locally:

```bash
truffle migrate --network development
```

Copy the local contract address into `src/js/abi.js` before using the local network. Ganache data and addresses are local to that Ganache workspace and are not shared with other computers.

## Demo flow

1. Connect a Shipper wallet and register it as Shipper.
2. Connect a second wallet and register it as Carrier.
3. As Shipper, create a named agreement and define milestone payout percentages that total 100%.
4. As Carrier, accept the agreement.
5. As Shipper, fund the exact declared amount.
6. As Carrier, select the agreement and submit a completion note.
7. As Shipper, verify the milestone to release its predefined payout.
8. Repeat until the agreement is completed, or trigger the refund after the deadline if it is not completed.

## Notes

- Ether values are entered in Ether in the frontend and converted to Wei before contract calls.
- Milestone payout amounts are calculated from the declared total and stored payout percentages; users do not manually enter each payment amount.
- The contract records business state and events on-chain. Personal Profile fields are intentionally local browser data and are not public blockchain data.

