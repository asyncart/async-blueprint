const { network } = require("hardhat");

module.exports = async ({ deployments }) => {
  const { deploy } = deployments;
  // const { deployer, admin } = await getNamedAccounts();
  const accounts = await ethers.getSigners();
  const deployer = accounts[0].address;
  await deploy("Blueprint", {
    from: deployer,
    proxy: {
      execute: {
        methodName: "initialize",
        args: ["Async Blueprint", "ABP"],
      },
    },
    log: true,
  });
};
module.exports.tags = ["all", "contracts"];
