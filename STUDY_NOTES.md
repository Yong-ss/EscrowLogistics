# EscrowLogistics 合约 - 复习笔记

## 1. 基础概念

| 术语 | 解释 |
|---|---|
| 区块链 | 大家共同维护、不可篡改的账本 |
| 智能合约 | 部署在链上的程序，任何人可调用 |
| Ganache | 本地测试用以太坊网络 |
| MetaMask | 浏览器钱包，签名交易、切换账户 |
| Gas | 执行操作要花的"手续费" |
| Wei | 以太币最小单位，1 Ether = 10^18 Wei |
| Truffle / Remix | 编译部署合约的工具 |
| web3.js | 前端调用合约函数的JS库 |

## 2. Solidity 基础语法

```solidity
pragma solidity ^0.8.0;   // 编译器版本
contract X { }            // 相当于 class
uint                       // 无符号整数
address                    // 账户地址
bool                       // 布尔值
mapping(K => V)            // 类似字典
struct                     // 自定义结构体（打包多个字段）
enum                       // 枚举（有限选项集合）
```

## 3. 本项目的角色与状态机

```solidity
enum Role { None, Shipper, Carrier }                    // 0, 1, 2
enum Status { Created, Funded, Completed, Refunded }    // 生命周期
```

**流程（状态机）**：
```
Created --(fund 打款)--> Funded --(verifyMilestone 全部完成)--> Completed
                            |
                            +--(过期未完成, refund)--> Refunded
```

## 4. 核心数据结构

```solidity
struct Agreement {
    uint id;
    address shipper;      // 货主
    address carrier;      // 承运人
    uint totalValue;      // 托管总金额(Wei)
    uint milestoneCount;  // 总里程碑数
    uint milestonesDone;  // 已完成里程碑数
    uint amountReleased;  // 已放款金额
    uint deadline;        // 截止时间(时间戳)
    Status status;
    uint declaredPayloadValue; // 创建时声明的托管金额(Wei)
}

struct Milestone {
    string name;           // 这一步要做什么
    string description;    // 给双方看的简单说明
}
```

存储方式：`mapping(uint => Agreement) public agreements;` —— 用 id 查合约中的每一份协议，类似字典。
每份协议的步骤存放在 `mapping(uint => Milestone[]) agreementMilestones` 中。

## 5. 状态变量（合约的"全局变量"）

```solidity
mapping(address => Role) public roles;        // 谁注册了什么角色
mapping(uint => Agreement) public agreements;  // 所有协议
mapping(uint => Milestone[]) agreementMilestones; // 每份协议的步骤说明
uint public agreementCount;                    // 协议计数器
mapping(address => uint) public reputation;    // 承运人信誉分
```

## 6. 事件 (Event) —— 前端读取历史记录的方式

区块链本身不方便"查询历史"，所以合约用 `event` 把关键动作广播出去，前端通过监听/查询这些事件日志重建"交易历史"：

```solidity
event Registered(address indexed user, Role role);
event AgreementCreated(uint indexed id, ...);
event Funded(uint indexed id, uint amount);
event MilestoneVerified(uint indexed id, uint milestoneNo, uint payout, address carrier);
event AgreementCompleted(uint indexed id);
event Refunded(uint indexed id, uint amount, address shipper);
```
`indexed` 表示这个字段可以被高效检索/过滤。

## 7. 修饰器 (Modifier) —— 权限检查的复用写法

```solidity
modifier onlyShipperOf(uint _id) {
    require(msg.sender == agreements[_id].shipper, "Only the shipper of this agreement");
    _;   // 表示"在这里插入被修饰函数的函数体"
}
```
用在函数签名上：`function fund(uint _id) public payable onlyShipperOf(_id)` —— 相当于"先检查调用者是不是这份协议的货主，通过了才执行函数体"。

`msg.sender` = 当前调用这个函数的人的地址（谁在MetaMask里签名，谁就是msg.sender）。

## 8. 核心函数逐个讲解

### (1) register — 注册身份
```solidity
function register(Role _role) public {
    require(_role == Role.Shipper || _role == Role.Carrier, "...");
    require(roles[msg.sender] == Role.None, "Address already registered");
    roles[msg.sender] = _role;
    emit Registered(msg.sender, _role);
}
```
- `require(条件, "错误信息")`：条件不满足就整个交易失败回滚（所有改动撤销），并退还没用完的gas
- 每个地址只能注册一次角色

### (2) createAgreement — 创建协议
```solidity
function createAgreement(
    address _carrier,
    uint _milestoneCount,
    uint _declaredPayloadValue,
    uint _deadline,
    string[] calldata _milestoneNames,
    string[] calldata _milestoneDescriptions
) public returns (uint) {
    require(roles[msg.sender] == Role.Shipper, "...");   // 调用者必须是Shipper
    require(roles[_carrier] == Role.Carrier, "...");     // 对方必须是Carrier
    require(_milestoneCount > 0, "...");
    require(_milestoneNames.length == _milestoneCount, "...");
    require(_milestoneDescriptions.length == _milestoneCount, "...");
    require(_declaredPayloadValue > 0, "...");
    require(_deadline > block.timestamp, "...");         // block.timestamp = 当前区块时间

    agreementCount++;
    agreements[agreementCount] = Agreement(...);          // 存入mapping
    // 同时存入每个 milestone 的 name 和 description
    emit AgreementCreated(...);
    return agreementCount;
}
```

### (3) fund — 打款进托管
```solidity
function fund(uint _id) public payable onlyShipperOf(_id) {
    Agreement storage a = agreements[_id];
    require(a.status == Status.Created, "...");
    require(msg.value > 0, "...");
    a.totalValue = msg.value;      // msg.value = 这次调用附带发送的以太币数量(Wei)
    a.status = Status.Funded;
    emit Funded(_id, msg.value);
}
```
- `payable` 关键字：允许这个函数接收以太币
- `storage` vs `memory`：`storage` 表示直接操作链上永久存储的数据（改了会真的存下来），`memory` 只是临时内存副本

### (4) verifyMilestone — 验证里程碑，分批放款（核心逻辑）
```solidity
function verifyMilestone(uint _id) public onlyShipperOf(_id) {
    Agreement storage a = agreements[_id];
    require(a.status == Status.Funded, "...");
    require(a.milestonesDone < a.milestoneCount, "...");
    require(block.timestamp <= a.deadline, "...");

    a.milestonesDone++;

    uint payout;
    if (a.milestonesDone == a.milestoneCount) {
        payout = a.totalValue - a.amountReleased;   // 最后一次把余数全付清，防止卡币
    } else {
        payout = a.totalValue / a.milestoneCount;   // 平均分摊
    }
    a.amountReleased += payout;

    (bool sent, ) = payable(a.carrier).call{value: payout}("");  // 低级转账写法
    require(sent, "Payout transfer failed");

    reputation[a.carrier] += 1;
    emit MilestoneVerified(_id, a.milestonesDone, payout, a.carrier);

    if (a.milestonesDone == a.milestoneCount) {
        a.status = Status.Completed;
        emit AgreementCompleted(_id);
    }
}
```
**为什么最后一笔要付"余数"而不是平均值？** 举例：3 ETH 分 3 次，正好整除没问题；但如果是 10 ETH 分 3 次，`10/3=3.33...`，Solidity整数除法会截断成3，如果三次都付3ETH，只付了9ETH，还剩1ETH卡在合约里。所以最后一次直接付"总额-已付"，保证不留余额。

**`.call{value: payout}("")` 是什么？** 这是Solidity推荐的转账方式（比 `.transfer()` 更安全灵活），返回 `(bool sent, bytes memory data)`，一定要检查 `sent` 是否成功。

### (5) refund — 超时退款
```solidity
function refund(uint _id) public {
    Agreement storage a = agreements[_id];
    require(a.status == Status.Funded, "...");
    require(block.timestamp > a.deadline, "...");   // 必须已经过期

    uint remaining = a.totalValue - a.amountReleased;
    a.status = Status.Refunded;

    (bool sent, ) = payable(a.shipper).call{value: remaining}("");
    require(sent, "Refund transfer failed");
    emit Refunded(_id, remaining, a.shipper);
}
```
注意：这里**先改状态**再转账（`a.status = Status.Refunded;` 在转账调用之前）。这是防重入攻击 (Reentrancy Attack) 的写法——如果先转账再改状态，恶意合约可能在收到钱的瞬间再次调用 refund，反复取钱。

### (6)/(7) 只读函数 (view)
```solidity
function getAgreement(uint _id) public view returns (Agreement memory) { ... }
function escrowBalance(uint _id) public view returns (uint) { ... }
```
`view` 表示这个函数不修改链上状态，只是读取——调用它不用花gas（前端本地调用时）。

## 9. 老师可能会问的高频问题 + 答案要点

**Q: 为什么用 `require` 而不是 `if`？**
A: `require` 条件不满足会直接revert（回滚）整个交易并退还剩余gas，是Solidity标准的输入校验/权限检查方式。

**Q: `msg.sender` 和 `msg.value` 分别是什么？**
A: `msg.sender` 是调用者地址；`msg.value` 是这次调用附带发送的以太币数量(Wei)，只有 `payable` 函数才能接收。

**Q: 这个合约怎么防止重入攻击？**
A: `refund` 和 `verifyMilestone` 都是"先更新状态，再做外部转账调用"（Checks-Effects-Interactions模式）。

**Q: 为什么用事件(event)而不是直接查询？**
A: 区块链没有内建"查历史"接口，链上存储读取历史成本很高；事件被记录在交易日志里，前端可以低成本地查询/监听这些日志来重建历史记录。

**Q: mapping和数组的区别？为什么用mapping存Agreement？**
A: mapping是键值对（哈希表），按id直接O(1)查找，不需要遍历；不能像数组一样遍历所有key，也没有length。

**Q: storage / memory / calldata 的区别？**
A: `storage`永久存在链上（改了要花gas，真实生效）；`memory`函数执行期间的临时数据；`calldata`函数外部调用参数的只读临时区域（比memory更省gas，通常用在external函数参数）。

**Q: `onlyShipperOf` modifier里的 `_;` 是什么意思？**
A: 占位符，表示"在这里插入使用这个modifier的函数体"。modifier检查通过后才会执行到`_;`处的原函数逻辑。

## 10. 整体架构一览

```
contracts/EscrowLogistics.sol   <- 智能合约（本笔记重点）
migrations/                     <- Truffle部署脚本
src/js/app.js                   <- 前端调用合约的web3.js逻辑
src/js/abi.js                   <- 合约地址 + ABI(接口描述)
server.js                       <- Express静态服务器，托管前端页面
```

**ABI (Application Binary Interface)**：告诉前端"这个合约有哪些函数、参数类型是什么"，这样web3.js才知道怎么打包调用数据。部署后拿到的合约地址+ABI，是前端连接合约的两个必要条件。
