require('dotenv').config()
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");

//Rinkeby & polygon test network
//NB Etherscan and AlchemyUrl is for Polygon network!!
const polygonPrivateKey = process.env.POLYGON_PRIVATE_KEY;
const rinkebyPrivateKey = process.env.RINKEBY_PRIVATE_KEY;
const alchemyUrl = process.env.ALCHEMY_URL;
const etherscanApiKey = process.env.ETHERSCAN_API_KEY; // Ploygn Key.
const coinmarketCapKey = process.env.COINMARKET_CAP_KEY;

module.exports = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
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
    },
    //Polygon Network
    mumbai: {
     url: alchemyUrl,
     accounts: [`0x${polygonPrivateKey}`]
   },
    // rinkeby: {
    //   url: alchemyUrl,
    //   accounts: [`0x${rinkebyPrivateKey}`],
    // },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: etherscanApiKey,
  },
};
