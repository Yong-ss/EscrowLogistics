// Builds the contract instance used to read/write EscrowLogistics.sol.

let escrowContract;   // the web3 contract instance, built from abi.js

const connectToContract = async () => {
  escrowContract = new web3Client.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
};
