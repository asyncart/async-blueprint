const { task } = require("hardhat/config");
const { BigNumber } = require("ethers");

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

task("deployRoyaltySplitterAndPrepareCreatorBlueprints", "Deploys royalty splitter and creator blueprint contract. Does not upload contract metadata. Sets default primary fee values, default royalty values.")
  .addParam("blueprintsFactory", "Blueprints factory address")
  .addParam("name", "Name of CreatorBlueprints contract")
  .addParam("symbol", "Symbol of CreatorBlueprints contract")
  .addParam("contractUri", "URI of contract-level metadata recognized by OpenSea")
  .addParam("artist", "Address of artist/creator")
  .addParam("capacity", "Blueprint capacity")
  .addParam("price", "Blueprint price")
  .addParam("erc20Token", "Address of erc20Token currency")
  .addParam("blueprintMetadata", "Metadata uri")
  .addParam("baseTokenUri", "Blueprint baseTokenUri")
  .addParam("merkleroot", "Blueprint merkle tree root for allowlist")
  .addParam("mintAmountArtist", "Maximum artist can mint")
  .addParam("mintAmountPlatform", "Maximum platform can mint")
  .addParam("maxPurchaseAmount", "Maximum amount purchasable by user")
  .addParam("saleEndTimestamp", "Unix timestamp of sale end")
  .setAction(async (taskArgs, { ethers }) => {
    const signers = await ethers.getSigners();
    const blueprintsFactory = new ethers.Contract(taskArgs.blueprintsFactory, BlueprintsFactoryABI, signers[0]); 

    const admins = await blueprintsFactory.defaultCreatorBlueprintsAdmins();
    const platform = admins[0]; 

    console.log(`Predicted split address to put into metadata: ${await blueprintsFactory.predictBlueprintsRoyaltiesSplitAddress(
        sortedAddressArray([platform, taskArgs.artist]),
        [250000, 750000]
    )}`)

    const tx = await blueprintsFactory.deployRoyaltySplitterAndPrepareCreatorBlueprints(
        [
            taskArgs.name,
            taskArgs.symbol,
            taskArgs.contractUri,
            taskArgs.artist 
        ],
        [
            taskArgs.capacity,
            taskArgs.price, 
            taskArgs.erc20Token,
            taskArgs.blueprintMetadata,
            taskArgs.baseTokenUri,
            taskArgs.merkleroot,
            taskArgs.mintAmountArtist,
            taskArgs.mintAmountPlatform,
            taskArgs.maxPurchaseAmount,
            taskArgs.saleEndTimestamp
        ],
        [
          [],
          []
        ],
        sortedAddressArray([platform, taskArgs.artist]),
        [250000, 750000],
        1000,
        "ID"
    )

    const txReceipt = await tx.wait(); 

    const iface = new ethers.utils.Interface(BlueprintsFactoryABI);
    const log = iface.parseLog(txReceipt.logs[5]); 
    const {creatorBlueprint, royaltySplit} = log.args;

    console.log(`CreatorBlueprints deployed to: ${creatorBlueprint}, corresponding royalty split deployed to: ${royaltySplit}`)
  });

function sortedAddressArray(addresses) {
    // assuming 2 values 
    if (BigNumber.from(addresses[0]).gte(BigNumber.from(addresses[1]))) {
        return [addresses[1], addresses[0]];
    } 
    return addresses;
}