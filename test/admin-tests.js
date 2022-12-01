const { expect } = require("chai");
const { BigNumber } = require("ethers");

const oneEth = BigNumber.from("1000000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const testUri = "https://randomUri/";
const testHash = "fbejgnvnveorjgnt";
const tenThousandPieces = 10000;
const zero = BigNumber.from(0).toString();

describe("Blueprint Supports Interface Tests", function () {
  let Blueprint;
  let SplitMain;
  let splitMain; 
  let blueprint;
  let CreatorBlueprint;
  let creatorBlueprint;
  let feesInput = {
    primaryFeeBPS: [],
    primaryFeeRecipients: [],
    secondaryFeesInput: {
      secondaryFeeRecipients: [],
      secondaryFeeMPS: [],
      totalRoyaltyCutBPS: 1000,
      royaltyRecipient: zeroAddress
    },
    deploySplit: false
  }
  let creatorFeeAllocationBPS = 500;

  beforeEach(async function () {
    [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
      await ethers.getSigners();

    feesInput.primaryFeeRecipients = [ContractOwner.address, testArtist.address];
    feesInput.primaryFeeBPS = [1000, 9000];
    feesInput.secondaryFeesInput.secondaryFeeRecipients = [ContractOwner.address, testArtist.address];
    feesInput.secondaryFeesInput.secondaryFeeMPS = [100000, 900000]    

    // deploy global blueprints
    Blueprint = await ethers.getContractFactory("BlueprintV12");
    blueprint = await Blueprint.deploy();

    // deploy royalty splitter
    SplitMain = await ethers.getContractFactory("SplitMain");
    splitMain = await SplitMain.deploy();

    // initialize the per creator blueprint contract
    CreatorBlueprint = await ethers.getContractFactory("contracts/contracts/CreatorBlueprints/contractVersions/CreatorBlueprints.sol:CreatorBlueprints");
    creatorBlueprint = await CreatorBlueprint.deploy(); 

    // initialize the per creator blueprint contract
    creatorBlueprint.initialize(["Steve's Blueprint", "ABP", "https://async.art/steve-metadata", testArtist.address], [ContractOwner.address, ContractOwner.address, ContractOwner.address], [splitMain.address, creatorFeeAllocationBPS], testPlatform.address);

    // intialize global blueprints contract
    blueprint.initialize("Async Blueprint", "ABP", [ContractOwner.address, ContractOwner.address, ContractOwner.address], splitMain.address);
  });
  describe("1.a: should update minter role", function () {
    it("BlueprintV12", async function() {
      await blueprint.connect(ContractOwner).updateMinterAddress(user2.address);
      await blueprint
        .connect(user2)
        .prepareBlueprint(
          testArtist.address,
          [
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            0,
            0,
            0,
            0
          ],
          feesInput
        );
      let result = await blueprint.blueprints(0);
      expect(result.artist).to.be.equal(testArtist.address);
    });
    it("CreatorBlueprints", async function() {
      await creatorBlueprint.connect(ContractOwner).updateMinterAddress(user2.address);
      await creatorBlueprint
        .connect(user2)
        .prepareBlueprint(
          [
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            0,
            0,
            0,
            0
          ],
          [[],[]]
        );
      let result = await creatorBlueprint.blueprint();
      expect(result.price).to.be.equal(oneEth);
    });
  });
  describe("1.b: should update platform address", function () {
    it("BlueprintV12", async function() {
      await blueprint.connect(ContractOwner).updatePlatformAddress(user2.address);
      let platformAddress = await blueprint.platform();
      expect(platformAddress).to.be.equal(user2.address);
    });
    it("CreatorBlueprints", async function() {
      await creatorBlueprint.connect(ContractOwner).updatePlatformAddress(user2.address);
      let platformAddress = await creatorBlueprint.platform();
      expect(platformAddress).to.be.equal(user2.address);
    });
  });
  describe("2.a: should allow minter to update merkleroot", function () {
    it("BlueprintV12", async function() {
      await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        testArtist.address,
        [
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0
        ],
        feesInput
      );
      let updatedMerkleroot = "0x0000000000000000000000000000000000000000000000000000000000000001";
      await blueprint.connect(ContractOwner).updateBlueprintMerkleroot(0, updatedMerkleroot);
      let result = await blueprint.blueprints(0);
      await expect(result.merkleroot).to.be.equal(updatedMerkleroot);
    });
    it("CreatorBlueprints", async function() {
      await creatorBlueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        [
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0
        ],
        [[], []]
      );
      let updatedMerkleroot = "0x0000000000000000000000000000000000000000000000000000000000000001";
      await creatorBlueprint.connect(ContractOwner).updateBlueprintMerkleroot(updatedMerkleroot);
      let result = await creatorBlueprint.blueprint();
      await expect(result.merkleroot).to.be.equal(updatedMerkleroot);
    });
  });
  describe("2.a: should allow for updating baseUri", function () {
    it("BlueprintV12", async function() {
      await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        testArtist.address,
        [
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0
        ],
        feesInput
      );
      let updatedUri = "http://updatedUri/";
      await blueprint.connect(ContractOwner).updateMinterAddress(user2.address);
      await blueprint
        .connect(user2)
        .updateBlueprintTokenUri(0, updatedUri);
      let result = await blueprint.blueprints(0);
      await expect(result.baseTokenUri).to.be.equal(updatedUri);
    });
    it("CreatorBlueprints", async function() {
      await creatorBlueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        [
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0
        ],
        [[], []]
      );
      let updatedUri = "http://updatedUri/";
      await creatorBlueprint.connect(ContractOwner).updateMinterAddress(user2.address);
      await creatorBlueprint
        .connect(user2)
        .updateBlueprintTokenUri(updatedUri);
      let result = await creatorBlueprint.blueprint();
      await expect(result.baseTokenUri).to.be.equal(updatedUri);
    });
  });
  describe("2.b: should not allow for updating baseUri for unprepared blueprint", function () {
    it("BlueprintV12", async function () {
      let updatedUri = "http://updatedUri/";
      await expect(
        blueprint.connect(ContractOwner).updateBlueprintTokenUri(0, updatedUri)
      ).to.be.revertedWith("!prepared");
    });
    it("CreatorBlueprint", async function () {
      let updatedUri = "http://updatedUri/";
      await expect(
        creatorBlueprint.connect(ContractOwner).updateBlueprintTokenUri(updatedUri)
      ).to.be.revertedWith("!prepared");
    });
  });
  describe("2.c: should lock token URI", function () {
    it("BlueprintV12", async function () {
      await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        testArtist.address,
        [
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0
        ],
        feesInput
      );
      let updatedUri = "http://updatedUri/";
      await blueprint.connect(ContractOwner).lockBlueprintTokenUri(0);
      await expect(
        blueprint.connect(ContractOwner).updateBlueprintTokenUri(0, updatedUri)
      ).to.be.revertedWith("locked");
    });
    it("CreatorBlueprint", async function () {
      await creatorBlueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        [
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0
        ],
        [[], []]
      );
      let updatedUri = "http://updatedUri/";
      await creatorBlueprint.connect(ContractOwner).lockBlueprintTokenUri();
      await expect(
        creatorBlueprint.connect(ContractOwner).updateBlueprintTokenUri(updatedUri)
      ).to.be.revertedWith("locked");
    });
  });
  describe("3: should reveal blueprint seed", function () {
    it("BlueprintV12", async function () {
      await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        testArtist.address,
        [
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0
        ],
        feesInput
      );
      let randomSeed = "randomSeedHash";
      await expect(blueprint.revealBlueprintSeed(0, randomSeed))
        .to.emit(blueprint, "BlueprintSeed")
        .withArgs(0, randomSeed);
      });
    it("CreatorBlueprint", async function () {
      await creatorBlueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        [
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0
        ],
        [[],[]]
      );
      let randomSeed = "randomSeedHash";
      await expect(creatorBlueprint.revealBlueprintSeed(randomSeed))
        .to.emit(creatorBlueprint, "BlueprintSeed")
        .withArgs(randomSeed);
    });
  });
  describe("4: should allow owner to set Async fee recipient", function () {
    it("BlueprintV12", async function () {
      await blueprint.connect(ContractOwner).setAsyncFeeRecipient(user3.address);
      let result = await blueprint.asyncSaleFeesRecipient();
      expect(result).to.be.equal(user3.address);
    });
    it("CreatorBlueprint", async function () {
      await creatorBlueprint.connect(ContractOwner).setAsyncFeeRecipient(user3.address);
      let result = await creatorBlueprint.asyncSaleFeesRecipient();
      expect(result).to.be.equal(user3.address);
    });
  });
  describe("6: should allow owner to change default Platform Fee Percentage", function () {
    it("BlueprintV12", async function () {
      await blueprint
      .connect(ContractOwner)
      .changeDefaultPlatformPrimaryFeePercentage(6000);
      let result = await blueprint.defaultPlatformPrimaryFeePercentage();
      expect(result.toString()).to.be.equal(BigNumber.from(6000).toString());
    });
    it("CreatorBlueprint", async function () {
      await creatorBlueprint
      .connect(ContractOwner)
      .changeDefaultPlatformPrimaryFeePercentage(6000);
      let result = await creatorBlueprint.defaultPlatformPrimaryFeePercentage();
      expect(result.toString()).to.be.equal(BigNumber.from(6000).toString());
    });
  });
  describe("7: should not allow owner to change default Platform Fee Percentage above 10000", function () {
    it("BlueprintV12", async function () {
      await expect(
        blueprint
          .connect(ContractOwner)
          .changeDefaultPlatformPrimaryFeePercentage(10600)
      ).to.be.revertedWith("");
    });
    it("CreatorBlueprint", async function () {
      await expect(
        creatorBlueprint
          .connect(ContractOwner)
          .changeDefaultPlatformPrimaryFeePercentage(10600)
      ).to.be.revertedWith("");
    });
  });
  describe("8: should allow owner to change default Secondary Fee Percentage", function () {
    it("BlueprintV12", async function () {
      await blueprint
      .connect(ContractOwner)
      .changeDefaultBlueprintSecondarySalePercentage(3000);
      let result = await blueprint.defaultBlueprintSecondarySalePercentage();
      expect(result.toString()).to.be.equal(BigNumber.from(3000).toString());
    });
    // CreatorBlueprints -- the secondary sales fees are the primary sales fees
  });
  describe("9: should not allow owner to change default  Secondary Fee Percentage above 10000", function () {
    it("BlueprintV12", async function () {
      await expect(
        blueprint
          .connect(ContractOwner)
          .changeDefaultBlueprintSecondarySalePercentage(10600)
      ).to.be.revertedWith("");
    });
    // CreatorBlueprints -- the secondary sales fees are the primary sales fees
  });
  describe("10: should allow owner to change default Platform Secondary Fee Percentage", function () {
    it("BlueprintV12", async function () {
      await blueprint
      .connect(ContractOwner)
      .changeDefaultPlatformSecondarySalePercentage(3000);
      let result = await blueprint.defaultPlatformSecondarySalePercentage();
      expect(result.toString()).to.be.equal(BigNumber.from(3000).toString());
    });
    // CreatorBlueprints -- the secondary sales fees are the primary sales fees
  });
  describe("11: should not allow owner to change default Platform Secondary Fee Percentage above 10000", function () {
    it("BlueprintV12", async function () {
      await expect(
        blueprint
          .connect(ContractOwner)
          .changeDefaultPlatformSecondarySalePercentage(10600)
      ).to.be.revertedWith("");
    });
    // CreatorBlueprints -- the secondary sales fees are the primary sales fees
  });
});