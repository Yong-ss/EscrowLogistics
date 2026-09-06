// Builds the contract instance used to read/write EscrowLogistics.sol.

let escrowContract;   // the web3 contract instance, built from abi.js

// Creates the Web3 object that lets the page call EscrowLogistics.sol.
const connectToContract = async () => {
  escrowContract = new web3Client.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);

  // Check the address before reading data, so a wrong MetaMask network gets a clear message.
  const contractCode = await web3Client.eth.getCode(CONTRACT_ADDRESS);
  if (!contractCode || /^0x0*$/.test(contractCode)) {
    throw new Error("Escrow contract is not deployed on this network");
  }
};
