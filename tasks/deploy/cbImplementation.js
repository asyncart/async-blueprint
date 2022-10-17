const { task } = require("hardhat/config");

task("deploy:cbImplementation", "Deploys CreatorBlueprints implementation")
  .setAction(async (taskArgs, { ethers }) => {
    const CreatorBlueprints = await ethers.getContractFactory("CreatorBlueprints");
    const creatorBlueprints = await CreatorBlueprints.deploy();

    await creatorBlueprints.deployed();

    console.log(`CreatorBlueprints deployed to: ${creatorBlueprints.address}`) 
  });