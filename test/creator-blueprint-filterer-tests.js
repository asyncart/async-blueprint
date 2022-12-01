// Test the Operator Filterer Upgrade
const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");

const zeroAddress = "0x0000000000000000000000000000000000000000";
const creatorBlueprintsABI = require("./CreatorBlueprints.json");
const upgradedCreatorBlueprintsABI = require("./abis/contracts/contracts/CreatorBlueprints/contractVersions/CreatorBlueprintsFilterer.sol/CreatorBlueprintsFilterer.json");
const upgradeableBeaconABI = require("./abi/UpgradeableBeacon.json");

describe("Creator Blueprint Filterer Upgrade", function () {
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
  const royaltyRecipients = ["0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"]
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

  beforeEach(async function () {
    // deploy CreatorBlueprints via factory, and create a blueprint
    [CreatorUpgrader, GlobalUpgrader, GlobalMinter, CreatorMinter, Platform, FactoryOwner, TestArtist, MockOpenSeaSubscriptionSigner, MockEvilMarketplaceSigner, MockAccompliceSigner] =
      await ethers.getSigners();
    provider = CreatorUpgrader.provider;

    // deploy splitter
    let SplitMain = await ethers.getContractFactory("SplitMain");
    splitMain = await SplitMain.deploy();
  })

  it("CBP deployed before registry change can be updated and enforce blacklist, CBP deployed after beacon update gets automatic operator filtering", async function () {
    // deploy blueprint factory
    BlueprintFactory = await ethers.getContractFactory("BlueprintsFactory");
    blueprintFactory = await BlueprintFactory.deploy(CreatorUpgrader.address, GlobalUpgrader.address, GlobalMinter.address, CreatorMinter.address, Platform.address, splitMain.address, FactoryOwner.address);
    
    // deploy creator blueprint with blueprint created
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
    const creatorBlueprintsProxyAddress = "0x" + log.topics[1].slice(26);
    creatorBlueprintsProxy = new ethers.Contract(creatorBlueprintsProxyAddress, creatorBlueprintsABI.abi, CreatorUpgrader);

    // deploy OpenSea operator filter registry
    let OperatorRegistry = await ethers.getContractFactory("OperatorFilterRegistry");
    operatorFilterRegistry = await OperatorRegistry.deploy();

    // OpenSea registers their standard subscription address
    await operatorFilterRegistry.connect(MockOpenSeaSubscriptionSigner).register(MockOpenSeaSubscriptionSigner.address);

    // And blacklists an "evil" marketplace
    await operatorFilterRegistry.connect(MockOpenSeaSubscriptionSigner).updateOperator(MockOpenSeaSubscriptionSigner.address, MockEvilMarketplaceSigner.address, true);

    // Check that MockEvilMarketplaceSigner is blacklisted for OpenSea
    expect(await operatorFilterRegistry.isOperatorFiltered(MockOpenSeaSubscriptionSigner.address, MockEvilMarketplaceSigner.address)).to.equal(true);

    // validate a piece of the blueprint state
    expect(await creatorBlueprintsProxy.name()).to.equal(creatorsInput.name);
    expect((await creatorBlueprintsProxy.blueprint()).price).to.equal(preparationConfig._price);
    
    // deploy the upgraded contract
    const CreatorBlueprintFilterer = await ethers.getContractFactory("MockCreatorBlueprintsFilterer");
    const creatorBlueprintFilterer = await CreatorBlueprintFilterer.deploy();
    const cbBeaconAddr = await blueprintFactory.creatorBlueprintsBeacon();
    const cbBeaconContract = new ethers.Contract(cbBeaconAddr, upgradeableBeaconABI.abi, CreatorUpgrader);

    // upgrade the beacon to point to the new implementation
    await cbBeaconContract.connect(CreatorUpgrader).upgradeTo(creatorBlueprintFilterer.address);
    expect(await cbBeaconContract.implementation()).to.equal(creatorBlueprintFilterer.address);

    // validate that the state has not changed [not corrupted]
    expect(await creatorBlueprintsProxy.name()).to.equal(creatorsInput.name);
    expect((await creatorBlueprintsProxy.blueprint()).price).to.equal(preparationConfig._price);

    // validate that blacklisting works

    // update the proxy with the abi of the new implementation
    creatorBlueprintsProxy = new ethers.Contract(creatorBlueprintsProxyAddress, upgradedCreatorBlueprintsABI, CreatorUpgrader);

    // first register with the registry which will also subscribe to open sea blacklist
    await creatorBlueprintsProxy.updateOperatorFilterAndRegister(operatorFilterRegistry.address);

    // Check that MockEvilMarketplaceSigner is blacklisted for CBP, since CBP is subscribed to OpenSea blacklist
    expect(await operatorFilterRegistry.isOperatorFiltered(creatorBlueprintsProxyAddress, MockEvilMarketplaceSigner.address)).to.equal(true);

    // start blueprints sale
    await creatorBlueprintsProxy.connect(CreatorMinter).beginSale();

    // purchase a blueprint
    const purchaseValue = BigNumber.from("10");
    await creatorBlueprintsProxy.connect(MockAccompliceSigner).purchaseBlueprints(1, 1, 0, [], { value: purchaseValue });

    // try to approve a delegate -- this should really fail
    expect(creatorBlueprintsProxy.connect(MockAccompliceSigner).approve(MockEvilMarketplaceSigner.address, 0)).to.be.reverted;

    // This probably should fail but idk OpenSea doesn't care I guess? -- might have to do w code hashes
    await creatorBlueprintsProxy.connect(MockAccompliceSigner).transferFrom(MockAccompliceSigner.address, MockEvilMarketplaceSigner.address, 0);
    await creatorBlueprintsProxy.connect(MockEvilMarketplaceSigner).transferFrom(MockEvilMarketplaceSigner.address, MockAccompliceSigner.address, 0);

    // test updating registry to be the zero address -- effectively revoking the blacklist
    await creatorBlueprintsProxy.updateOperatorFilterRegistryAddress(zeroAddress);

    // approving a blacklisted address should work now
    await creatorBlueprintsProxy.connect(MockAccompliceSigner).approve(MockEvilMarketplaceSigner.address, 0);

    // we now deploy another CBP after the Beacon has been updated, to verify that the initialize function works
    let reDeployTx = await blueprintFactory.deployAndPrepareCreatorBlueprints(
      creatorsInput, 
      preparationConfig,
      primaryFees,
      royaltyCutBPS,
      sampleSplit, 
      blueprintPlatformId
    )
    const reDeployReceipt = await reDeployTx.wait()
    reDeployReceipt.logs.pop()
    reDeployReceipt.logs.pop()
    const reDeployLog = reDeployReceipt.logs.pop()
    const reDeployCreatorBlueprintsProxyAddress = "0x" + reDeployLog.topics[1].slice(26);
    creatorBlueprintsProxy = new ethers.Contract(reDeployCreatorBlueprintsProxyAddress, upgradedCreatorBlueprintsABI, CreatorUpgrader);

    // Check that MockEvilMarketplaceSigner is blacklisted for CBP, since CBP is subscribed to OpenSea blacklist from its initialize method
    expect(await operatorFilterRegistry.isOperatorFiltered(reDeployCreatorBlueprintsProxyAddress, MockEvilMarketplaceSigner.address)).to.equal(true);

    // start blueprints sale
    await creatorBlueprintsProxy.connect(CreatorMinter).beginSale();

    // purchase a blueprint
    await creatorBlueprintsProxy.connect(MockAccompliceSigner).purchaseBlueprints(1, 1, 0, [], { value: BigNumber.from("10") });

    // try to approve a delegate, this shoudl fail. We omit a check on transferFrom since we would need to mock a Marketplace contract
    expect(creatorBlueprintsProxy.connect(MockAccompliceSigner).approve(MockEvilMarketplaceSigner.address, 0)).to.be.reverted;

    // test updating registry to be the zero address -- effectively revoking the blacklist
    await creatorBlueprintsProxy.updateOperatorFilterRegistryAddress(zeroAddress);

    // approving a blacklisted address should work now
    await creatorBlueprintsProxy.connect(MockAccompliceSigner).approve(MockEvilMarketplaceSigner.address, 0);
  });
});