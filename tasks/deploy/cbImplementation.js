const { task } = require("hardhat/config");

task("deploy:cbImplementation", "Deploys CreatorBlueprints implementation")
  .setAction(async (taskArgs, { ethers }) => {
    const CreatorBlueprints = await ethers.getContractFactory("CreatorBlueprints");
    const creatorBlueprints = await CreatorBlueprints.deploy();
    console.log(creatorBlueprints.deployTransaction.hash)

    await creatorBlueprints.deployed();

    console.log(`CreatorBlueprints deployed to: ${creatorBlueprints.address}`) 
  });

task("deploy:v12Implementation", "Deploys BlueprintV12 implementation")
  .setAction(async (taskArgs, { ethers }) => {
    const BlueprintV12 = await ethers.getContractFactory("BlueprintV12");
    const blueprintV12 = await BlueprintV12.deploy();
    console.log(blueprintV12.deployTransaction.hash)

    await blueprintV12.deployed();

    console.log(`BlueprintV12 deployed to: ${blueprintV12.address}`) 
  });