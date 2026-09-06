const HDWalletProvider = require("@truffle/hdwallet-provider");
module.exports = {
  // Networks define how you connect to your Ethereum client.
  networks: {
    // Ganache GUI default (Lab 8.1 / 8.2)
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*", // match any network id
    },
    // truffle develop built-in test chain
    develop: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "*",
    },
    sepolia: {
      // Deployment uses a separate test wallet. Keep its mnemonic outside GitHub.
      provider: () => {
        if (!process.env.SEPOLIA_MNEMONIC) {
          throw new Error("Set SEPOLIA_MNEMONIC before deploying to Sepolia.");
        }
        return new HDWalletProvider(
          process.env.SEPOLIA_MNEMONIC,
          "https://ethereum-sepolia-rpc.publicnode.com"
        );
      },
      network_id: 11155111,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },

  // Configure the Solidity compiler to match the contract pragma.
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
};
