const { expect, assert } = require("chai");
const { intToBuffer } = require("ethjs-util");
const { ethers } = require("hardhat");
const blueprintV12ABI = require("./BlueprintV12.json");
const creatorBlueprintsABI = require("./CreatorBlueprints.json");

describe("Blueprint Factory Deployer Tests", function () {
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

  beforeEach(async function () {
    [CreatorUpgrader, GlobalUpgrader, GlobalMinter, CreatorMinter, Platform, FactoryOwner, TestArtist] =
      await ethers.getSigners();
    provider = CreatorUpgrader.provider;

    // deploy splitter
    let SplitMain = await ethers.getContractFactory("SplitMain");
    splitMain = await SplitMain.deploy();

    // deploy global blueprint splitter
    BlueprintFactory = await ethers.getContractFactory("BlueprintsFactory");
    blueprintFactory = await BlueprintFactory.deploy(CreatorUpgrader.address, GlobalUpgrader.address, GlobalMinter.address, CreatorMinter.address, Platform.address, splitMain.address, FactoryOwner.address);

    // validate constructor
    expect((await blueprintFactory.defaultCreatorBlueprintsAdmins()).platform).to.be.equal(Platform.address)
    expect((await blueprintFactory.defaultCreatorBlueprintsAdmins()).minter).to.be.equal(CreatorMinter.address)
    expect((await blueprintFactory.defaultCreatorBlueprintsAdmins()).asyncSaleFeesRecipient).to.be.equal(Platform.address)

    expect((await blueprintFactory.defaultBlueprintV12Admins()).platform).to.be.equal(Platform.address)
    expect((await blueprintFactory.defaultBlueprintV12Admins()).minter).to.be.equal(GlobalMinter.address)
    expect((await blueprintFactory.defaultBlueprintV12Admins()).asyncSaleFeesRecipient).to.be.equal(Platform.address)
  });
  describe("global deployments", function () {
    it("Deploy BlueprintsV12 by itself", async function() {
      let deployGlobalTxn = await blueprintFactory.deployGlobalBlueprint("Blueprint for ART", "ART")
      let deployGlobalReciept = await deployGlobalTxn.wait()
      let blueprintAddr = "0x" + deployGlobalReciept.logs.pop().topics.pop().slice(26)
      let BlueprintV12 = new ethers.Contract(blueprintAddr, blueprintV12ABI.abi, provider);
      expect(await BlueprintV12.name()).to.equal("Blueprint for ART");
      expect(await BlueprintV12.symbol()).to.equal("ART");
      expect(await BlueprintV12.platform()).to.equal(Platform.address);
      expect(await BlueprintV12.minterAddress()).to.equal(GlobalMinter.address);
      expect(await BlueprintV12.asyncSaleFeesRecipient()).to.equal(Platform.address);
    });
  });
  describe("creator deployments", function () {
    it("Deploy Creator Specific Contract", async function() {
      let deployCreatorTxn = await blueprintFactory.deployCreatorBlueprints(creatorsInput, royaltyCutBPS, sampleSplit, blueprintPlatformId)
      let deployCreatorReciept = await deployCreatorTxn.wait()
      let creatorBlueprintDeployedLog = deployCreatorReciept.logs.pop()
      let splitAddr = ("0x" + creatorBlueprintDeployedLog.topics.pop().slice(26))
      expect(ethers.utils.getAddress(splitAddr)).to.equal(sampleSplit);
      let creatorBlueprintAddr = ("0x" + creatorBlueprintDeployedLog.topics.pop().slice(26))
      let CreatorBlueprint = new ethers.Contract(creatorBlueprintAddr, creatorBlueprintsABI.abi, provider);
      expect(await CreatorBlueprint.name()).to.equal(creatorsInput.name);
      expect(await CreatorBlueprint.symbol()).to.equal(creatorsInput.symbol);
      expect(await CreatorBlueprint.platform()).to.equal(Platform.address);
      expect(await CreatorBlueprint.minterAddress()).to.equal(CreatorMinter.address);
      expect(await CreatorBlueprint.asyncSaleFeesRecipient()).to.equal(Platform.address);
      expect(ethers.utils.getAddress(await CreatorBlueprint.artist())).to.equal(ethers.utils.getAddress(creatorsInput.artist));
    });

    it("deployCreatorBlueprintsAndRoyaltySplitter", async function() {
        const tx = await blueprintFactory.deployCreatorBlueprintsAndRoyaltySplitter(
            creatorsInput, 
            royaltyRecipients, 
            allocations, 
            royaltyCutBPS, 
            blueprintPlatformId
        )
        const receipt = await tx.wait()
        const log = receipt.logs.pop()
        const splitAddress = "0x" + log.topics.pop().slice(26)
        const creatorBlueprintsAddress = "0x" + log.topics[1].slice(26)
        const creatorBlueprints = new ethers.Contract(creatorBlueprintsAddress, creatorBlueprintsABI.abi, provider);
        expect(await creatorBlueprints.name()).to.equal(creatorsInput.name);
        expect(await creatorBlueprints.symbol()).to.equal(creatorsInput.symbol);
        expect(await creatorBlueprints.platform()).to.equal(Platform.address);
        expect(await creatorBlueprints.minterAddress()).to.equal(CreatorMinter.address);
        expect(await creatorBlueprints.asyncSaleFeesRecipient()).to.equal(Platform.address); 
        expect(await creatorBlueprints.artist()).to.equal(creatorsInput.artist); 
        expect(await creatorBlueprints.royaltyParameters()).to.eql([ethers.utils.getAddress(splitAddress), royaltyCutBPS])
      });

      it("deployAndPrepareCreatorBlueprints", async function() {
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
        const splitAddress = "0x" + log.topics.pop().slice(26)
        const creatorBlueprintsAddress = "0x" + log.topics[1].slice(26)
        const creatorBlueprints = new ethers.Contract(creatorBlueprintsAddress, creatorBlueprintsABI.abi, provider);
        expect(await creatorBlueprints.name()).to.equal(creatorsInput.name);
        expect(await creatorBlueprints.symbol()).to.equal(creatorsInput.symbol);
        expect(await creatorBlueprints.platform()).to.equal(Platform.address);
        expect(await creatorBlueprints.minterAddress()).to.equal(CreatorMinter.address);
        expect(await creatorBlueprints.asyncSaleFeesRecipient()).to.equal(Platform.address); 
        expect(await creatorBlueprints.artist()).to.equal(creatorsInput.artist); 
        expect(await creatorBlueprints.royaltyParameters()).to.eql([ethers.utils.getAddress(splitAddress), royaltyCutBPS])
        expect((await creatorBlueprints.blueprint()).price).to.equal(preparationConfig._price)
        expect((await creatorBlueprints.blueprint()).baseTokenUri).to.equal(preparationConfig._baseTokenUri)
        expect((await creatorBlueprints.blueprint()).saleEndTimestamp).to.equal(preparationConfig._saleEndTimestamp)
      });

      it("deployRoyaltySplitterAndPrepareCreatorBlueprints", async function() {
        const tx = await blueprintFactory.deployRoyaltySplitterAndPrepareCreatorBlueprints(
            creatorsInput, 
            preparationConfig,
            primaryFees,
            royaltyRecipients,
            allocations,
            royaltyCutBPS,
            blueprintPlatformId
        )
        const receipt = await tx.wait()
        receipt.logs.pop()
        receipt.logs.pop()
        const log = receipt.logs.pop()
        const splitAddress = "0x" + log.topics.pop().slice(26)
        const creatorBlueprintsAddress = "0x" + log.topics[1].slice(26)
        const creatorBlueprints = new ethers.Contract(creatorBlueprintsAddress, creatorBlueprintsABI.abi, provider);
        expect(await creatorBlueprints.name()).to.equal(creatorsInput.name);
        expect(await creatorBlueprints.symbol()).to.equal(creatorsInput.symbol);
        expect(await creatorBlueprints.platform()).to.equal(Platform.address);
        expect(await creatorBlueprints.minterAddress()).to.equal(CreatorMinter.address);
        expect(await creatorBlueprints.asyncSaleFeesRecipient()).to.equal(Platform.address); 
        expect(await creatorBlueprints.artist()).to.equal(creatorsInput.artist); 
        expect(await creatorBlueprints.royaltyParameters()).to.eql([ethers.utils.getAddress(splitAddress), royaltyCutBPS])
        expect((await creatorBlueprints.blueprint()).price).to.equal(preparationConfig._price)
        expect((await creatorBlueprints.blueprint()).baseTokenUri).to.equal(preparationConfig._baseTokenUri)
        expect((await creatorBlueprints.blueprint()).saleEndTimestamp).to.equal(preparationConfig._saleEndTimestamp)
      });
  });
});