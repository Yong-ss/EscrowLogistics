const EscrowLogistics = artifacts.require("EscrowLogistics");

module.exports = function (deployer) {
  deployer.deploy(EscrowLogistics);
};
