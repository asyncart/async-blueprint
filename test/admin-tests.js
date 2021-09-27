const { expect } = require("chai");
const { BigNumber } = require("ethers");

const oneEth = BigNumber.from("1000000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const testUri = "https://randomUri/";
const testHash = "fbejgnvnveorjgnt";
const tenThousandPieces = 10000;
const zero = BigNumber.from(0).toString();

const emptyFeeRecipients = [];
const emptyFeePercentages = [];

describe("Admin Blueprint Tests", function () {
  let Blueprint;
  let blueprint;
  let feeRecipients;
  let feeBps;

  beforeEach(async function () {
    [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
      await ethers.getSigners();

    feeRecipients = [ContractOwner.address, testArtist.address];
    feeBps = [1000, 9000];

    Blueprint = await ethers.getContractFactory("Blueprint");
    blueprint = await Blueprint.deploy();
    blueprint.initialize("Async Blueprint", "ABP");
  });
  it("1: should update admin role", async function () {
    await blueprint.connect(ContractOwner).updatePlatformAddress(user2.address);
    await blueprint
      .connect(user2)
      .prepareBlueprint(
        testArtist.address,
        tenThousandPieces,
        oneEth,
        zeroAddress,
        testHash,
        testUri,
        feeRecipients,
        feeBps,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        0,
        0
      );
    let result = await blueprint.blueprints(0);
    expect(result.artist).to.be.equal(testArtist.address);
  });
  it("2: should allow for updating baseUri", async function () {
    await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        testArtist.address,
        tenThousandPieces,
        oneEth,
        zeroAddress,
        testHash,
        testUri,
        feeRecipients,
        feeBps,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        0,
        0
      );
    let updatedUri = "http://updatedUri/";
    await blueprint.connect(ContractOwner).updateBaseTokenUri(0, updatedUri);
    let result = await blueprint.blueprints(0);
    await expect(result.baseTokenUri).to.be.equal(updatedUri);
  });
  it("2: should not allow for updating baseUri for unprepared blueprint", async function () {
    let updatedUri = "http://updatedUri/";
    await expect(
      blueprint.connect(ContractOwner).updateBaseTokenUri(0, updatedUri)
    ).to.be.revertedWith("blueprint not prepared");
  });
  it("3: should reveal blueprint seed", async function () {
    await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        testArtist.address,
        tenThousandPieces,
        oneEth,
        zeroAddress,
        testHash,
        testUri,
        feeRecipients,
        feeBps,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        0,
        0
      );
    let randomSeed = "randomSeedHash";
    await expect(blueprint.revealBlueprintSeed(0, randomSeed))
      .to.emit(blueprint, "BlueprintSeed")
      .withArgs(0, randomSeed);
  });
  it("4: should allow owner to set Async fee recipient", async function () {
    await blueprint.connect(ContractOwner).setAsyncFeeRecipient(user3.address);
    let result = await blueprint.asyncSaleFeesRecipient();
    expect(result).to.be.equal(user3.address);
  });
  it("6: should allow owner to change default Platform Fee Percentage", async function () {
    await blueprint
      .connect(ContractOwner)
      .changedefaultPlatformFeePercentage(6000);
    let result = await blueprint.defaultPlatformFeePercentage();
    expect(result.toString()).to.be.equal(BigNumber.from(6000).toString());
  });
  it("7: should not allow owner to change default Blueprint Fee Percentage above 10000", async function () {
    await expect(
      blueprint.connect(ContractOwner).changedefaultPlatformFeePercentage(10600)
    ).to.be.revertedWith("");
  });
});
