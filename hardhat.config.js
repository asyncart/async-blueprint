require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require('hardhat-contract-sizer');

const {
  rinkebyPrivateKey,
  alchemyUrl,
  etherscanApiKey,
  coinmarketCapKey,
} = require("./secretsManager.example.js");

module.exports = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 30,
    coinmarketcap: coinmarketCapKey,
  },
  paths: {
    deploy: "./contracts/deploy",
    deployments: "deployments",
    imports: "imports",
    tests: "./test",
  },

  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      initialBaseFeePerGas: 0,
    }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: etherscanApiKey,
  }
};
