const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners()
  const BlueprintsFactory = await hre.ethers.getContractFactory("BlueprintsFactory");
  const blueprintsFactory = await BlueprintsFactory.deploy(
    signers[0].address,
    signers[0].address,
    "name",
    "symbol",
    signers[0].address,
    signers[0].address, 
    signers[0].address,
    signers[0].address,
    signers[0].address
  );

  await blueprintsFactory.deployed();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
