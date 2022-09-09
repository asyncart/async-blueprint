const { task } = require("hardhat/config");

task("deploy:splitMain", "Deploys SplitMain contract - use on local networks or ones 0xSplits hasn't deployed on")
  .setAction(async (taskArgs, { ethers }) => {
    const SplitMain = await ethers.getContractFactory("SplitMain");
    const splitMain = await SplitMain.deploy();

    await splitMain.deployed();
    console.log(`SplitMain deployed to ${splitMain.address}`);
  });