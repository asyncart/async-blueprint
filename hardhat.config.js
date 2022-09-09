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
  goerliPrivateKey,
  mumbaiPrivateKey,
  alchemyUrl,
  etherscanApiKey,
  coinmarketCapKey,
} = require("./secretsManager.js");

require("./tasks/deploy");
require("./tasks/factory")

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
    // deploy: "./contracts/deploy",
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
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/",
      accounts: [rinkebyPrivateKey]
    },
    goerli: {
      url: "https://rpc.ankr.com/eth_goerli",
      accounts: [goerliPrivateKey]
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com/",
      accounts: [mumbaiPrivateKey]
    }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: etherscanApiKey,
  },
  contractSizer: {
    runOnCompile: true
  }
};
