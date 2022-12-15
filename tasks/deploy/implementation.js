const { task } = require("hardhat/config");
const creatorBlueprintsABI = require("../../test/abis/contracts/contracts/CreatorBlueprints/contractVersions/CreatorBlueprints.sol/CreatorBlueprints.json");
const blueprintV12ABI = require("../../test/BlueprintV12.json")
const BlueprintsFactoryABI = [
  {
      "inputs": [],
      "name": "defaultCreatorBlueprintsAdmins",
      "outputs": [
        {
          "internalType": "address",
          "name": "platform",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "minter",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "asyncSaleFeesRecipient",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address[]",
          "name": "royaltyRecipients",
          "type": "address[]"
        },
        {
          "internalType": "uint32[]",
          "name": "allocations",
          "type": "uint32[]"
        }
      ],
      "name": "predictBlueprintsRoyaltiesSplitAddress",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "symbol",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "contractURI",
              "type": "string"
            },
            {
              "internalType": "address",
              "name": "artist",
              "type": "address"
            }
          ],
          "internalType": "struct CreatorBlueprints.CreatorBlueprintsInput",
          "name": "creatorBlueprintsInput",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint64",
              "name": "_capacity",
              "type": "uint64"
            },
            {
              "internalType": "uint128",
              "name": "_price",
              "type": "uint128"
            },
            {
              "internalType": "address",
              "name": "_erc20Token",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "_blueprintMetaData",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "_baseTokenUri",
              "type": "string"
            },
            {
              "internalType": "bytes32",
              "name": "_merkleroot",
              "type": "bytes32"
            },
            {
              "internalType": "uint32",
              "name": "_mintAmountArtist",
              "type": "uint32"
            },
            {
              "internalType": "uint32",
              "name": "_mintAmountPlatform",
              "type": "uint32"
            },
            {
              "internalType": "uint64",
              "name": "_maxPurchaseAmount",
              "type": "uint64"
            },
            {
              "internalType": "uint128",
              "name": "_saleEndTimestamp",
              "type": "uint128"
            },
            {
              "components": [
                {
                  "internalType": "uint32[]",
                  "name": "primaryFeeBPS",
                  "type": "uint32[]"
                },
                {
                  "internalType": "address[]",
                  "name": "primaryFeeRecipients",
                  "type": "address[]"
                }
              ],
              "internalType": "struct CreatorBlueprints.Fees",
              "name": "_feeRecipientInfo",
              "type": "tuple"
            }
          ],
          "internalType": "struct CreatorBlueprints.BlueprintPreparationConfig",
          "name": "blueprintPreparationConfig",
          "type": "tuple"
        },
        {
          "internalType": "address[]",
          "name": "royaltyRecipients",
          "type": "address[]"
        },
        {
          "internalType": "uint32[]",
          "name": "allocations",
          "type": "uint32[]"
        },
        {
          "internalType": "uint32",
          "name": "royaltyCutBPS",
          "type": "uint32"
        }
      ],
      "name": "deployRoyaltySplitterAndPrepareCreatorBlueprints",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
]

task("deploy:cbImplementation", "Deploys CreatorBlueprints implementation")
  .setAction(async (taskArgs, { ethers }) => {
    const CreatorBlueprints = await ethers.getContractFactory("CreatorBlueprints");
    const creatorBlueprints = await CreatorBlueprints.deploy();
    console.log(creatorBlueprints.deployTransaction.hash)

    await creatorBlueprints.deployed();

    console.log(`CreatorBlueprints deployed to: ${creatorBlueprints.address}`) 
  });

task("deploy:cbImplementation-operator-filterer", "Deploys CreatorBlueprintsFilterer implementation")
  .setAction(async (taskArgs, { ethers }) => {
    const CreatorBlueprintsFilterer = await ethers.getContractFactory("CreatorBlueprintsFilterer");
    const creatorBlueprintsFilterer = await CreatorBlueprintsFilterer.deploy();
    console.log(creatorBlueprintsFilterer.deployTransaction.hash)

    await creatorBlueprintsFilterer.deployed();

    console.log(`CreatorBlueprintsFilterer deployed to: ${creatorBlueprintsFilterer.address}`) 
  });

task("deploy:cbImplementation-ownership-transferred", "Deploys CreatorBlueprintsFilterer implementation")
  .setAction(async (taskArgs, { ethers }) => {
    const CreatorBlueprintsOwnershipTransferred = await ethers.getContractFactory("CreatorBlueprintsOwnershipTransferred");
    const creatorBlueprintsOwnershipTransferred = await CreatorBlueprintsOwnershipTransferred.deploy();
    console.log(creatorBlueprintsOwnershipTransferred.deployTransaction.hash)

    await creatorBlueprintsOwnershipTransferred.deployed();

    console.log(`CreatorBlueprintsOwnershipTransferred deployed to: ${creatorBlueprintsOwnershipTransferred.address}`) 
  });

task("deploy:v12Implementation", "Deploys BlueprintV12 implementation")
  .setAction(async (taskArgs, { ethers }) => {
    const BlueprintV12 = await ethers.getContractFactory("BlueprintV12");
    const blueprintV12 = await BlueprintV12.deploy();
    console.log(blueprintV12.deployTransaction.hash)

    await blueprintV12.deployed();

    console.log(`BlueprintV12 deployed to: ${blueprintV12.address}`) 
  });

task("cb:encoded-initialize", "Log the encoded call to initialize")
  .addParam("proxy", "Address of a CreatorBlueprints proxy")
  .addParam("factory", "Address of BlueprintsFactory")
  .setAction(async (taskArgs, { ethers }) => {
    const signers = await ethers.getSigners();
    const cb = new ethers.Contract(taskArgs.proxy, creatorBlueprintsABI, signers[0]); 
    const factory = new ethers.Contract(taskArgs.factory, BlueprintsFactoryABI, signers[0]); 

    const creatorBlueprintsInput = [
      await cb.name(),
      await cb.symbol(),
      await cb.contractURI(),
      await cb.artist()
    ]
    console.log(creatorBlueprintsInput)
    const defaultCreatorBlueprintsAdmins = await factory.defaultCreatorBlueprintsAdmins()
    const royaltyParameters = await cb.royaltyParameters()
    
    const functionData = cb.interface.encodeFunctionData("initialize", [
      creatorBlueprintsInput,
      defaultCreatorBlueprintsAdmins,
      royaltyParameters,
      ethers.constants.AddressZero // extra minter
    ])

    console.log(functionData)
  });

  task("v12:encoded-initialize", "Log the encoded call to initialize")
  .addParam("proxy", "Address of a BlueprintV12 proxy")
  .addParam("factory", "Address of BlueprintsFactory")
  .setAction(async (taskArgs, { ethers }) => {
    const signers = await ethers.getSigners();
    const v12 = new ethers.Contract(taskArgs.proxy, blueprintV12ABI.abi, signers[0]); 
    const factory = new ethers.Contract(taskArgs.factory, BlueprintsFactoryABI, signers[0]); 

    const name = await v12.name()
    const symbol = await v12.symbol()
    const defaultBlueprintV12Admins = await factory.defaultBlueprintV12Admins()
    const splitMain = "0x2ed6c4B5dA6378c7897AC67Ba9e43102Feb694EE"
    
    const functionData = v12.interface.encodeFunctionData("initialize", [
      name,
      symbol,
      defaultBlueprintV12Admins,
      splitMain
    ])

    console.log(functionData)
  });