// Builds the contract instance used to read/write EscrowLogistics.sol.

let escrowContract;   // the web3 contract instance, built from abi.js

// Creates the Web3 object that lets the page call EscrowLogistics.sol.
const connectToContract = async () => {
  escrowContract = new web3Client.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
};
