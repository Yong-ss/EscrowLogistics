const EscrowLogistics = artifacts.require("EscrowLogistics");

contract("EscrowLogistics milestones", ([shipper, carrier, observer]) => {
  // Small helper for checking that the contract rejects an invalid action.
  const expectRevert = async (promise, expectedMessage) => {
    try {
      await promise;
      assert.fail("Expected transaction to revert");
    } catch (error) {
      assert(error.message.includes(expectedMessage), error.message);
    }
  };

  // Uses Ganache's current chain time instead of the computer clock.
  const futureDeadline = async (seconds) => {
    const latestBlock = await web3.eth.getBlock("latest");
    return Number(latestBlock.timestamp) + seconds;
  };

  // Creates the same simple funded agreement used by the milestone tests.
  const createFundedAgreement = async (instance) => {
    await instance.register(1, { from: shipper });
    await instance.register(2, { from: carrier });
    await instance.createAgreement(
      carrier,
      "Test shipment",
      2,
      web3.utils.toWei("2", "ether"),
      await futureDeadline(3600),
      ["Pickup", "Delivered"],
      ["Collect the package", "Deliver it to the customer"],
      [30, 70],
      { from: shipper }
    );
    await instance.acceptAgreement(1, { from: carrier });
    await instance.fund(1, {
      from: shipper,
      value: web3.utils.toWei("2", "ether"),
    });
  };

  // Ganache helper: move blockchain time forward so deadline rules can be tested.
  const movePastDeadline = async () => {
    await new Promise((resolve, reject) => web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [3601],
      id: new Date().getTime(),
    }, (error) => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => web3.currentProvider.send({
      jsonrpc: "2.0",
      method: "evm_mine",
      params: [],
      id: new Date().getTime(),
    }, (error) => error ? reject(error) : resolve()));
  };

  it("stores milestone names and descriptions when an agreement is created", async () => {
    const instance = await EscrowLogistics.new();
    await instance.register(1, { from: shipper });
    await instance.register(2, { from: carrier });

    await instance.createAgreement(
      carrier,
      "Test shipment",
      2,
      web3.utils.toWei("2", "ether"),
      await futureDeadline(3600),
      ["Pickup", "Delivered"],
      ["Collect the package", "Deliver it to the customer"],
      [30, 70],
      { from: shipper }
    );

    const first = await instance.getMilestone(1, 0);
    const second = await instance.getMilestone(1, 1);

    assert.equal(first.name, "Pickup");
    assert.equal(first.description, "Collect the package");
    assert.equal(second.name, "Delivered");
    assert.equal(second.description, "Deliver it to the customer");
  });

  it("stores the agreement name", async () => {
    const instance = await EscrowLogistics.new();
    await instance.register(1, { from: shipper });
    await instance.register(2, { from: carrier });

    await instance.createAgreement(
      carrier,
      "Warehouse delivery",
      1,
      web3.utils.toWei("1", "ether"),
      await futureDeadline(3600),
      ["Pickup"],
      ["Collect the package"],
      [100],
      { from: shipper }
    );

    const agreement = await instance.getAgreement(1);
    assert.equal(agreement.name, "Warehouse delivery");
  });

  it("requires Carrier acceptance before funding", async () => {
    const instance = await EscrowLogistics.new();
    await instance.register(1, { from: shipper });
    await instance.register(2, { from: carrier });

    await instance.createAgreement(
      carrier,
      "Waiting for acceptance",
      1,
      web3.utils.toWei("1", "ether"),
      await futureDeadline(3600),
      ["Pickup"],
      ["Collect the package"],
      [100],
      { from: shipper }
    );

    await expectRevert(
      instance.fund(1, { from: shipper, value: web3.utils.toWei("1", "ether") }),
      "Carrier has not accepted"
    );
  });

  it("does not allow funding after the agreement deadline", async () => {
    const instance = await EscrowLogistics.new();
    await instance.register(1, { from: shipper });
    await instance.register(2, { from: carrier });

    await instance.createAgreement(
      carrier,
      "Expired agreement",
      1,
      web3.utils.toWei("1", "ether"),
      await futureDeadline(60),
      ["Pickup"],
      ["Collect the package"],
      [100],
      { from: shipper }
    );
    await instance.acceptAgreement(1, { from: carrier });
    await movePastDeadline();

    await expectRevert(
      instance.fund(1, { from: shipper, value: web3.utils.toWei("1", "ether") }),
      "Deadline has passed"
    );
  });

  it("does not allow a refund before the deadline", async () => {
    const instance = await EscrowLogistics.new();
    await createFundedAgreement(instance);

    await expectRevert(
      instance.refund(1, { from: observer }),
      "Deadline has not passed yet"
    );
  });

  it("rejects an agreement ID that does not exist", async () => {
    const instance = await EscrowLogistics.new();
    await expectRevert(instance.getAgreement(2), "Agreement does not exist");
  });

  it("stores the Carrier completion note for the current milestone", async () => {
    const instance = await EscrowLogistics.new();
    await createFundedAgreement(instance);

    await instance.submitMilestone(1, "Collected the package from the warehouse", {
      from: carrier,
    });

    const milestone = await instance.getMilestone(1, 0);
    assert.equal(milestone.submissionNote, "Collected the package from the warehouse");
    assert.equal(milestone.submitted, true);
  });

  it("does not allow the Shipper to verify before the Carrier submits", async () => {
    const instance = await EscrowLogistics.new();
    await createFundedAgreement(instance);

    await expectRevert(
      instance.verifyMilestone(1, { from: shipper }),
      "Carrier has not submitted this milestone"
    );
  });

  it("stores payout percentages and releases that percentage after verification", async () => {
    const instance = await EscrowLogistics.new();
    await createFundedAgreement(instance);

    await instance.submitMilestone(1, "Collected the package", { from: carrier });
    await instance.verifyMilestone(1, { from: shipper });

    const milestone = await instance.getMilestone(1, 0);
    const agreement = await instance.getAgreement(1);
    assert.equal(milestone.payoutPercentage.toString(), "30");
    assert.equal(agreement.amountReleased.toString(), web3.utils.toWei("0.6", "ether"));
  });

  it("releases the full escrow after the final milestone", async () => {
    const instance = await EscrowLogistics.new();
    await createFundedAgreement(instance);

    for (const note of ["Collected the package", "Delivered the package"]) {
      await instance.submitMilestone(1, note, { from: carrier });
      await instance.verifyMilestone(1, { from: shipper });
    }

    const agreement = await instance.getAgreement(1);
    assert.equal(agreement.amountReleased.toString(), web3.utils.toWei("2", "ether"));
    assert.equal((await instance.escrowBalance(1)).toString(), "0");
  });

  it("returns only the unreleased escrow after the deadline", async () => {
    const instance = await EscrowLogistics.new();
    await createFundedAgreement(instance);

    await instance.submitMilestone(1, "Collected the package", { from: carrier });
    await instance.verifyMilestone(1, { from: shipper });
    await movePastDeadline();

    const result = await instance.refund(1, { from: observer });
    const agreement = await instance.getAgreement(1);
    const refundEvent = result.logs.find((log) => log.event === "Refunded");

    assert.equal(refundEvent.args.amount.toString(), web3.utils.toWei("1.4", "ether"));
    assert.equal(agreement.status.toString(), "3");
    assert.equal(agreement.amountReleased.toString(), web3.utils.toWei("0.6", "ether"));
    assert.equal((await instance.escrowBalance(1)).toString(), "0");
    assert.equal((await web3.eth.getBalance(instance.address)).toString(), "0");
  });

  it("requires milestone payout percentages to total 100", async () => {
    const instance = await EscrowLogistics.new();
    await instance.register(1, { from: shipper });
    await instance.register(2, { from: carrier });

    await expectRevert(
      instance.createAgreement(
        carrier,
        "Invalid payout plan",
        2,
        web3.utils.toWei("2", "ether"),
        await futureDeadline(3600),
        ["Pickup", "Delivered"],
        ["Collect the package", "Deliver it to the customer"],
        [30, 60],
        { from: shipper }
      ),
      "Payout percentages must total 100"
    );
  });
});
