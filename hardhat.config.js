require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require('hardhat-contract-sizer');
require('hardhat-abi-exporter');

const {
  evmPrivateKey,
  etherscanApiKey,
  coinmarketCapKey,
} = require("./secretsManager");

require("./tasks/deploy");
require("./tasks/factory")
require("./tasks/royalties");

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
    goerli: evmPrivateKey ? {
      url: "https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [evmPrivateKey]
    } : { url: "https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161" },
    mainnet: evmPrivateKey ? {
      url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      accounts: [evmPrivateKey]
    } : { url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161" }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: etherscanApiKey,
  },
  contractSizer: {
    runOnCompile: true
  },
  abiExporter: {
    path: './test/abis',
    runOnCompile: true,
    clear: true,
    flat: false,
    only: [':CreatorBlueprints$'],
    spacing: 2
  }
};
