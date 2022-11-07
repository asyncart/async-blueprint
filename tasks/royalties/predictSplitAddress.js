const { task } = require("hardhat/config");

const SplitMainABI = [
    {
        "inputs": [
          {
            "internalType": "address[]",
            "name": "accounts",
            "type": "address[]"
          },
          {
            "internalType": "uint32[]",
            "name": "percentAllocations",
            "type": "uint32[]"
          },
          {
            "internalType": "uint32",
            "name": "distributorFee",
            "type": "uint32"
          }
        ],
        "name": "predictImmutableSplitAddress",
        "outputs": [
          {
            "internalType": "address",
            "name": "split",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
]

task("predictSplitAddress", "Predicts royalty split address based on inputs")
  .addParam("splitMain", "SplitMain address")
  .addParam("distributorFee", "SplitMain distributor fee")
 // .addPositionalParam("accounts", "Royalty recipient accounts")
 // .addPositionalParam("allocations", "Royalty percent allocations")
  .setAction(async (taskArgs, { ethers }) => {
    const signers = await ethers.getSigners();
    const splitMain = new ethers.Contract(taskArgs.splitMain, SplitMainABI, signers[0]);
    
    console.log(`Predicted split address: 
        ${await splitMain.predictImmutableSplitAddress(["0x8Ac794937899956d0402841E620E5C866e9e1097"], [1000000], taskArgs.distributorFee)}
    `)
  });