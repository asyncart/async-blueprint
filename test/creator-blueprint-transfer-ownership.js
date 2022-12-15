// Test the Operator Filterer Upgrade
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");

const zeroAddress = "0x0000000000000000000000000000000000000000";
const creatorBlueprintsABI = require("./CreatorBlueprints.json");
const upgradedCreatorBlueprintsABI = require("./abis/contracts/contracts/CreatorBlueprints/contractVersions/CreatorBlueprintsFilterer.sol/CreatorBlueprintsFilterer.json");
const upgradeableBeaconABI = require("./abi/UpgradeableBeacon.json");

describe("Creator Blueprint Transfer Ownership Upgrade", function () {
  let BlueprintFactory;
  let blueprintFactory;
  let provider;
  let splitMain;
  let creatorBlueprintsProxy;
  let operatorFilterRegistry;
  let MockOpenSeaSubscriptionSigner;
  let MockEvilMarketplaceSigner;
  let MockAccompliceSigner;
  const sampleSplit = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  const creatorsInput = {
    "name": "Steve's Blueprint",
    "symbol": "STEVE",
    "contractURI": "https://mything",
    "artist": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  }
  const royaltyCutBPS = 500
  const blueprintPlatformId = "mongo-id"

  beforeEach(async function () {
    // deploy CreatorBlueprints via factory, and create a blueprint
    [CreatorUpgrader, GlobalUpgrader, GlobalMinter, CreatorMinter, Platform, FactoryOwner, TestArtist, MockOpenSeaSubscriptionSigner, MockEvilMarketplaceSigner, MockAccompliceSigner] =
      await ethers.getSigners();
    provider = CreatorUpgrader.provider;

    // deploy splitter
    let SplitMain = await ethers.getContractFactory("SplitMain");
    splitMain = await SplitMain.deploy();
  })

  it("Test transfer ownership event", async function () {
    // deploy blueprint factory
    BlueprintFactory = await ethers.getContractFactory("BlueprintsFactory");
    blueprintFactory = await BlueprintFactory.deploy(CreatorUpgrader.address, GlobalUpgrader.address, GlobalMinter.address, CreatorMinter.address, Platform.address, splitMain.address, FactoryOwner.address);

    // deploy OpenSea operator filter registry
    let OperatorRegistry = await ethers.getContractFactory("OperatorFilterRegistry");
    operatorFilterRegistry = await OperatorRegistry.deploy();

    // deploy the upgraded contract
    const CreatorBlueprintUpgraded = await ethers.getContractFactory("MockCreatorBlueprintsOwnershipTransferred");
    const creatorBlueprintUpgraded = await CreatorBlueprintUpgraded.deploy();

    // upgrade the beacon on the factory to point to the new implementation
    const cbBeaconAddr = await blueprintFactory.creatorBlueprintsBeacon();
    const cbBeaconContract = new ethers.Contract(cbBeaconAddr, upgradeableBeaconABI.abi, CreatorUpgrader);
    await cbBeaconContract.connect(CreatorUpgrader).upgradeTo(creatorBlueprintUpgraded.address);
    expect(await cbBeaconContract.implementation()).to.equal(creatorBlueprintUpgraded.address);
    
    // deploy new creator blueprint contract, and validate ownership transfer event
    const tx = await blueprintFactory.deployCreatorBlueprints(
      creatorsInput,
      royaltyCutBPS,
      sampleSplit, 
      blueprintPlatformId
    )
    const receipt = await tx.wait()
    const log = receipt.logs.find(log => log.logIndex === 4)
    const creatorBlueprintsProxyAddress = "0x" + log.topics[1].slice(26);
    creatorBlueprintsProxy = new ethers.Contract(creatorBlueprintsProxyAddress, creatorBlueprintsABI.abi, CreatorUpgrader);

    // validate basic state
    expect(await creatorBlueprintsProxy.name()).to.equal(creatorsInput.name);

    // validate ownership transferred event emitted as expected
    const ownershipTransferredLog = receipt.logs.find(log => log.logIndex === 5)
    const emittedOwner = "0x" + ownershipTransferredLog.topics[1].slice(26);
    expect(emittedOwner).to.equal(Platform.address.toLowerCase());
  });
});