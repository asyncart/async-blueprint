const { ethers, upgrades, network } = require("hardhat");
var instanceAddress;


async function main() {
  // Deploying
  const BlueprintV10 = await ethers.getContractFactory("BlueprintV10");
  const instance = await upgrades.deployProxy(BlueprintV10, ["Afro auto3", "AA3", "0x0C0aB132F5a8d0988e88997cb2604F494052BDEF"]);
  await instance.deployed();
  instanceAddress = instance.address
  console.log("BlueprintV10 deployed to:", instance.address);
}

main();


// https://mumbai.polygonscan.com/address/0xce8aeac842559b1652fcc77c5e4967dc6bdfbf65#code
// function initialize(
//         string memory name_,
//         string memory symbol_,
//         address minter
//     )
//
//



// module.exports = async ({ deployments }) => {
//   const { deploy } = deployments;
//   //const { deployer, admin } = await getNamedAccounts();
//   const accounts = await ethers.getSigners();
//   const deployer = accounts[0].address;
//   await deploy("BlueprintV11", {
//     from: deployer,
//     proxy: {
//       execute: {
//         proxyContract: "UUPSProxy",
//         methodName: "initialize",
//         args: ["Async Blueprint", "ABP"],
//       },
//     },
//     log: true,
//   });
// };
// module.exports.tags = ["all", "contracts",];
