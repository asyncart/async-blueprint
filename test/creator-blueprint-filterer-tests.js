// Test both BlueprintV12 and CreatorBlueprint prepareBlueprint external function

const mapping = require("./merkle_mapping.json");
const { expect } = require("chai");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");

const oneEth = BigNumber.from("1000000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const testUri = "https://randomUri/";
const testHash = "fbejgnvnveorjgnt";
const tenThousandPieces = 10000;
const zero = BigNumber.from(0).toString();
const emptyFeesInput = {
  primaryFeeBPS: [],
  primaryFeeRecipients: [],
  secondaryFeesInput: {
    secondaryFeeRecipients: [],
    secondaryFeeMPS: [],
    totalRoyaltyCutBPS: 0,
    royaltyRecipient: zeroAddress
  },
  deploySplit: false
}
const creatorBlueprintsABI = require("./CreatorBlueprints.json");
const upgradeableBeaconABI = require("./abi/UpgradeableBeacon.json");

describe("Creator Blueprint Filterer Upgrade", function () {
  let BlueprintFactory;
  let blueprintFactory;
  let provider;
  let artist;
  let splitMain;
  const sampleSplit = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  const creatorsInput = {
    "name": "Steve's Blueprint",
    "symbol": "STEVE",
    "contractURI": "https://mything",
    "artist": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  }
  const royaltyCutBPS = 500
  const blueprintPlatformId = "mongo-id"
  const royaltyRecipients = ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"]
  const allocations = [500000, 500000]
  const primaryFees = {
    "primaryFeeBPS": [1000, 9000],
    "primaryFeeRecipients": royaltyRecipients
  }

  const preparationConfig = {
    _capacity: 10,
    _price: 10,
    _erc20Token: ethers.constants.AddressZero,
    _blueprintMetaData: "test metadata",
    _baseTokenUri: "test uri",
    _merkleroot: ethers.constants.HashZero,
    _mintAmountArtist: 5,
    _mintAmountPlatform: 5,
    _maxPurchaseAmount: 2,
    _saleEndTimestamp: 100000000000000
  }
  const newDefaultAdmins = {
    platform: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    minter: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    asyncSaleFeesRecipient: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  }
  it("Upgrade test", async function () {
    // deploy CreatorBlueprints via factory, and create a blueprint
    [CreatorUpgrader, GlobalUpgrader, GlobalMinter, CreatorMinter, Platform, FactoryOwner, TestArtist] =
      await ethers.getSigners();
    provider = CreatorUpgrader.provider;

    // deploy splitter
    let SplitMain = await ethers.getContractFactory("SplitMain");
    splitMain = await SplitMain.deploy();

    // deploy global blueprint splitter
    BlueprintFactory = await ethers.getContractFactory("BlueprintsFactory");
    blueprintFactory = await BlueprintFactory.deploy(CreatorUpgrader.address, GlobalUpgrader.address, GlobalMinter.address, CreatorMinter.address, Platform.address, splitMain.address, FactoryOwner.address);
    const tx = await blueprintFactory.deployAndPrepareCreatorBlueprints(
      creatorsInput, 
      preparationConfig,
      primaryFees,
      royaltyCutBPS,
      sampleSplit, 
      blueprintPlatformId
    )
    const receipt = await tx.wait()
    receipt.logs.pop()
    receipt.logs.pop()
    const log = receipt.logs.pop()
    const creatorBlueprintsProxyAddress = "0x" + log.topics[1].slice(26)
    console.log("provider.getSigner is ", provider.getSigner());
    const creatorBlueprints = new ethers.Contract(creatorBlueprintsProxyAddress, creatorBlueprintsABI.abi, provider);
    // validate a piece of the blueprint state
    expect(await creatorBlueprints.name()).to.equal(creatorsInput.name);
    expect((await creatorBlueprints.blueprint()).price).to.equal(preparationConfig._price);
    // deploy the upgraded contract
    const CreatorBlueprintFilterer = await ethers.getContractFactory("contracts/contracts/CreatorBlueprints/CreatorBlueprints.sol:CreatorBlueprints");
    const creatorBlueprintFilterer = await CreatorBlueprintFilterer.deploy();
    const cbBeaconAddr = await blueprintFactory.creatorBlueprintsBeacon();
    const cbBeaconContract = new ethers.Contract(cbBeaconAddr, upgradeableBeaconABI.abi, CreatorUpgrader);

    // upgrade the beacon to point to the new implementation
    await cbBeaconContract.connect(CreatorUpgrader).upgradeTo(creatorBlueprintFilterer.address);
    expect(await cbBeaconContract.implementation()).to.equal(creatorBlueprintFilterer.address);

    // validate that the state has not changed [not corrupted]
    expect(await creatorBlueprints.name()).to.equal(creatorsInput.name);
    expect((await creatorBlueprints.blueprint()).price).to.equal(preparationConfig._price);
  })
});