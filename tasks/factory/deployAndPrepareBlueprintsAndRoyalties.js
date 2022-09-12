const { task } = require("hardhat/config");
const { BigNumber } = require("ethers");

const BlueprintsFactory = require("../../artifacts/contracts/contracts/deployment/BlueprintsFactory.sol/BlueprintsFactory.json");
const BlueprintsFactoryABI = BlueprintsFactory.abi; 

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
        [250000, 750000])
    }`)

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
            taskArgs.saleEndTimestamp,
            [
                [],
                []
            ]
        ],
        sortedAddressArray([platform, taskArgs.artist]),
        [250000, 750000],
        1000
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
        console.log("switch")
        return [addresses[1], addresses[0]];
    } 
    return addresses;
}