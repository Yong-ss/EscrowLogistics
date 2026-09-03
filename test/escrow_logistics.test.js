const EscrowLogistics = artifacts.require("EscrowLogistics");

contract("EscrowLogistics milestones", ([shipper, carrier]) => {
  it("stores milestone names and descriptions when an agreement is created", async () => {
    const instance = await EscrowLogistics.new();
    await instance.register(1, { from: shipper });
    await instance.register(2, { from: carrier });

    await instance.createAgreement(
      carrier,
      2,
      web3.utils.toWei("2", "ether"),
      Math.floor(Date.now() / 1000) + 3600,
      ["Pickup", "Delivered"],
      ["Collect the package", "Deliver it to the customer"],
      { from: shipper }
    );

    const first = await instance.getMilestone(1, 0);
    const second = await instance.getMilestone(1, 1);

    assert.equal(first.name, "Pickup");
    assert.equal(first.description, "Collect the package");
    assert.equal(second.name, "Delivered");
    assert.equal(second.description, "Deliver it to the customer");
  });
});
