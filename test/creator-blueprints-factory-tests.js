// test factory variables set right after construction

// test deploy with factory

// test creator blueprints contract minimally or maximally with all vectors from other tests pasted in

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
  let sampleSplit = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase()
  let creatorsInput = {
    "name": "Steve's Blueprint",
    "symbol": "STEVE",
    "contractURI": "https://mything",
    "artist": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266".toLowerCase()
  }
  let royaltyCutBPS = 500
  let blueprintPlatformId = "mongo-id"

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
      let splitAddr = ("0x" + creatorBlueprintDeployedLog.topics.pop().slice(26)).toLowerCase();
      expect(splitAddr).to.equal(sampleSplit);
      let creatorBlueprintAddr = ("0x" + creatorBlueprintDeployedLog.topics.pop().slice(26)).toLowerCase();
      let CreatorBlueprint = new ethers.Contract(creatorBlueprintAddr, creatorBlueprintsABI.abi, provider);
      expect(await CreatorBlueprint.name()).to.equal(creatorsInput.name);
      expect(await CreatorBlueprint.symbol()).to.equal(creatorsInput.symbol);
      expect(await CreatorBlueprint.platform()).to.equal(Platform.address);
      expect(await CreatorBlueprint.minterAddress()).to.equal(CreatorMinter.address);
      expect(await CreatorBlueprint.asyncSaleFeesRecipient()).to.equal(Platform.address);
      expect(ethers.utils.getAddress(await CreatorBlueprint.artist())).to.equal(ethers.utils.getAddress(creatorsInput.artist));
    });
  });
});