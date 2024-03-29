const { task } = require("hardhat/config");

task("deploy:blueprintsFactory", "Deploys Blueprints factory")
  .addParam("creatorBlueprintsUpgrader", "Account that can upgrade CreatorBlueprints beacon implementation")
  .addParam("blueprintV12Upgrader", "Account that can upgrade BlueprintV12 beacon implementation")
  .addParam("blueprintV12Minter", "Permissioned minter for BlueprintV12")
  .addParam("creatorBlueprintsMinter", "Default permissioned minter for CreatorBlueprints")
  .addParam("platform", "Default DEFAULT_ADMIN_ROLE / platform address holder for CreatorBlueprints")
  .addParam("splitMain", "Address of SplitMain royalties contract from 0xSplits")
  .addParam("factoryOwner", "Owner of deployed factory, able to change default values such as default minter for CreatorBlueprints")
  .setAction(async (taskArgs, { ethers }) => {
    const BlueprintsFactory = await ethers.getContractFactory("BlueprintsFactory");
    const blueprintsFactory = await BlueprintsFactory.deploy(
        taskArgs.creatorBlueprintsUpgrader,
        taskArgs.blueprintV12Upgrader,
        taskArgs.blueprintV12Minter,
        taskArgs.creatorBlueprintsMinter, 
        taskArgs.platform,
        taskArgs.splitMain,
        taskArgs.factoryOwner
    );

    await blueprintsFactory.deployed();

    console.log(`Blueprints factory deployed to: ${blueprintsFactory.address}`) 
  });