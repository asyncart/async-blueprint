const { ethers, upgrades, network } = require("hardhat");
// set inn proxy address here.!!!
const contractAddress = "0xbb395cC3bcC4eaCbF6487e69a6e8E5Df4d61c2e2"


async function main() {

  // Upgrading
  const BlueprintV11 = await ethers.getContractFactory("BlueprintV11");
  const upgraded = await upgrades.upgradeProxy(contractAddress, BlueprintV11, ["Collection Name", "TICKER", "0x0C0aB132F5a8d0988e88997cb2604F494052BDEF"]);
}

main();





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
