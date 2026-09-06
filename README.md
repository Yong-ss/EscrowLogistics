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
├── .gitignore                    # Files that should not be committed
├── contracts/
│   ├── EscrowLogistics.sol        # escrow, roles, milestones, payouts, and refunds
│   └── Migrations.sol             # Truffle migration helper contract
├── migrations/
│   ├── 1_initial_migration.js    # Deploys the Truffle Migrations contract
│   └── 2_deploy_contracts.js     # Deploys the EscrowLogistics contract
├── src/
│   ├── agreement-details.html     # Shows one agreement's details and history
│   ├── agreements.html            # Shows the connected wallet's agreements
│   ├── carrier-jobs.html          # Carrier accepts jobs and submits milestones
│   ├── create-agreement.html      # Shipper creates an agreement
│   ├── fund.html                  # Shipper funds an accepted agreement
│   ├── index.html                 # Main role-based dashboard
│   ├── profile.html               # Browser-based profile information
│   ├── refund.html                # Deadline refund action for the Shipper
│   ├── register.html              # Wallet registration and role selection
│   ├── verify.html                # Shipper verifies submitted milestones
│   ├── css/
│   │   └── style.css              # Shared layout, form, card, and page styling
│   ├── js/
│   │   ├── abi.js                 # Contract ABI and deployed contract address
│   │   ├── siteShell.js           # Loads shared HTML partials and page shell setup
│   │   ├── controllers/
│   │   │   ├── agreementController.js # Agreement list, details, and history actions
│   │   │   ├── carrierController.js   # Carrier jobs, acceptance, and submissions
│   │   │   ├── pageController.js       # Role-based page access and page loading
│   │   │   ├── profileController.js    # Profile form and avatar actions
│   │   │   ├── registerController.js   # User role registration actions
│   │   │   └── shipperController.js    # Agreement, funding, verification, and refund actions
│   │   ├── services/
│   │   │   ├── contractConnection.js  # Creates the Web3 smart contract connection
│   │   │   └── walletConnection.js     # Connects MetaMask and tracks the wallet
│   │   └── utils/
│   │       ├── domUtils.js             # DOM updates and readable blockchain errors
│   │       ├── formatUtils.js          # Formats roles, statuses, and blockchain events
│   │       ├── milestoneUtils.js       # Builds and reads milestone form fields
│   │       └── profileUtils.js         # Saves and loads browser profile data
│   └── partials/
│       ├── footer.html             # Shared page footer
│       ├── header.html             # Shared page header and wallet area
│       └── sidebar.html            # Shared role-based navigation sidebar
├── package-lock.json               # Locked npm dependency versions
├── package.json                    # Project scripts and npm dependencies
├── README.md                       # Project description and setup instructions
├── server.js                       # Express static server on port 5000
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
