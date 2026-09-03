// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Decentralized Escrow and Milestone-Based Logistics Platform
// Shippers lock Ether into escrow; funds are released to the Carrier
// progressively as milestones are verified. If the Carrier misses the
// deadline, the unreleased balance is refunded to the Shipper.
contract EscrowLogistics {

    // ---------- Types ----------
    enum Role { None, Shipper, Carrier }                    // 0, 1, 2
    enum Status { Created, Funded, Completed, Refunded }    // agreement lifecycle

    struct Agreement {
        uint id;
        address shipper;
        address carrier;
        uint totalValue;             // total Ether locked, in Wei (set once funded)
        uint milestoneCount;         // total milestones agreed
        uint milestonesDone;         // milestones verified so far
        uint amountReleased;         // Wei already paid to the carrier
        uint deadline;               // block.timestamp by which milestones must be done
        Status status;
        uint declaredPayloadValue;   // total payload value declared at creation, in Wei
    }

    struct Milestone {
        string name;             // short title, such as "Pickup from warehouse"
        string description;      // plain instructions visible to both sides
    }

    // ---------- State ----------
    mapping(address => Role) public roles;          // who is a Shipper / Carrier
    mapping(uint => Agreement) public agreements;   // all agreements by id
    mapping(uint => Milestone[]) private agreementMilestones;
    uint public agreementCount;                     // running counter of agreements
    mapping(address => uint) public reputation;     // carrier reputation points

    // ---------- Events (frontend reads these for history) ----------
    event Registered(address indexed user, Role role);
    event AgreementCreated(uint indexed id, address indexed shipper, address indexed carrier, uint milestoneCount, uint declaredPayloadValue, uint deadline);
    event Funded(uint indexed id, uint amount);
    event MilestoneVerified(uint indexed id, uint milestoneNo, uint payout, address carrier);
    event AgreementCompleted(uint indexed id);
    event Refunded(uint indexed id, uint amount, address shipper);

    // ---------- Modifiers ----------
    // Reusable check: only the Shipper who owns this agreement may continue.
    modifier onlyShipperOf(uint _id) {
        require(msg.sender == agreements[_id].shipper, "Only the shipper of this agreement");
        _;
    }

    // ---------- 1. Registration ----------
    // Saves one wallet's role so the contract can check permissions later.
    function register(Role _role) public {
        require(_role == Role.Shipper || _role == Role.Carrier, "Role must be Shipper or Carrier");
        require(roles[msg.sender] == Role.None, "Address already registered");
        roles[msg.sender] = _role;
        emit Registered(msg.sender, _role);
    }

    // ---------- 2. Agreement creation ----------
    // _declaredPayloadValue is the total payload value the Shipper commits to
    // funding, in Wei, declared up front at creation time.
    // Shipper creates an agreement and records the simple plan for every milestone.
    function createAgreement(
        address _carrier,
        uint _milestoneCount,
        uint _declaredPayloadValue,
        uint _deadline,
        string[] calldata _milestoneNames,
        string[] calldata _milestoneDescriptions
    ) public returns (uint) {
        require(roles[msg.sender] == Role.Shipper, "Only a registered Shipper can create");
        require(roles[_carrier] == Role.Carrier, "Assigned address is not a Carrier");
        require(_milestoneCount > 0, "Need at least one milestone");
        require(_milestoneNames.length == _milestoneCount, "Milestone names do not match count");
        require(_milestoneDescriptions.length == _milestoneCount, "Milestone descriptions do not match count");
        require(_declaredPayloadValue > 0, "Declared payload value must be greater than zero");
        require(_deadline > block.timestamp, "Deadline must be in the future");

        agreementCount++;
        agreements[agreementCount] = Agreement(
            agreementCount,
            msg.sender,
            _carrier,
            0,                  // totalValue set on funding
            _milestoneCount,
            0,                  // milestonesDone
            0,                  // amountReleased
            _deadline,
            Status.Created,
            _declaredPayloadValue
        );

        // Store the plan in the same order the Shipper entered it.
        for (uint i = 0; i < _milestoneCount; i++) {
            require(bytes(_milestoneNames[i]).length > 0, "Milestone name is required");
            agreementMilestones[agreementCount].push(
                Milestone(_milestoneNames[i], _milestoneDescriptions[i])
            );
        }

        emit AgreementCreated(agreementCount, msg.sender, _carrier, _milestoneCount, _declaredPayloadValue, _deadline);
        return agreementCount;
    }

    // ---------- 3. Funding (lock Ether into escrow) ----------
    // Shipper locks the exact declared amount into this agreement.
    function fund(uint _id) public payable onlyShipperOf(_id) {
        Agreement storage a = agreements[_id];
        require(a.status == Status.Created, "Agreement is not awaiting funding");
        require(msg.value == a.declaredPayloadValue, "Funded amount must match the declared payload value");

        a.totalValue = msg.value;
        a.status = Status.Funded;

        emit Funded(_id, msg.value);
    }

    // ---------- 4. Milestone verification + progressive payout ----------
    // Shipper approves the next step and sends its payment to the Carrier.
    function verifyMilestone(uint _id) public onlyShipperOf(_id) {
        Agreement storage a = agreements[_id];
        require(a.status == Status.Funded, "Agreement is not in progress");
        require(a.milestonesDone < a.milestoneCount, "All milestones already done");
        require(block.timestamp <= a.deadline, "Deadline has passed");

        a.milestonesDone++;

        // Release an even share; the final milestone releases the remainder
        // so rounding never leaves funds stuck in the contract.
        uint payout;
        if (a.milestonesDone == a.milestoneCount) {
            payout = a.totalValue - a.amountReleased;
        } else {
            payout = a.totalValue / a.milestoneCount;
        }
        a.amountReleased += payout;

        // recommended low-level transfer pattern (Lab 6)
        (bool sent, ) = payable(a.carrier).call{value: payout}("");
        require(sent, "Payout transfer failed");

        reputation[a.carrier] += 1;   // reward the carrier

        emit MilestoneVerified(_id, a.milestonesDone, payout, a.carrier);

        if (a.milestonesDone == a.milestoneCount) {
            a.status = Status.Completed;
            emit AgreementCompleted(_id);
        }
    }

    // ---------- 5. Refund on missed deadline ----------
    // Deliberately callable by anyone (no onlyShipperOf/onlyCarrier check): the
    // EVM has no built-in scheduler, so a contract can never execute itself once
    // a deadline passes. Any account can be the one to submit this transaction
    // once block.timestamp > deadline, so the refund still fires without relying
    // on the Shipper remembering to click a button - the closest a smart contract
    // can get to "automatic" without an external keeper/automation service.
    // Anyone can start the refund after the deadline; money goes back to the Shipper.
    function refund(uint _id) public {
        Agreement storage a = agreements[_id];
        require(a.status == Status.Funded, "Only a funded agreement can be refunded");
        require(block.timestamp > a.deadline, "Deadline has not passed yet");

        uint remaining = a.totalValue - a.amountReleased;
        a.status = Status.Refunded;

        (bool sent, ) = payable(a.shipper).call{value: remaining}("");
        require(sent, "Refund transfer failed");

        emit Refunded(_id, remaining, a.shipper);
    }

    // ---------- 6/7. Views ----------
    // Returns all stored information for one agreement without changing the blockchain.
    function getAgreement(uint _id) public view returns (Agreement memory) {
        return agreements[_id];
    }

    // Anyone can read one milestone so both sides know what that step means.
    function getMilestone(uint _agreementId, uint _milestoneNo)
        public
        view
        returns (string memory name, string memory description)
    {
        require(_milestoneNo < agreementMilestones[_agreementId].length, "Milestone does not exist");
        Milestone memory milestone = agreementMilestones[_agreementId][_milestoneNo];
        return (milestone.name, milestone.description);
    }

    // Calculates how much Ether is still locked in the agreement.
    function escrowBalance(uint _id) public view returns (uint) {
        Agreement memory a = agreements[_id];
        return a.totalValue - a.amountReleased;
    }
}
