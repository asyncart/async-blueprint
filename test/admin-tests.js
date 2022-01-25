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

    Blueprint = await ethers.getContractFactory("BlueprintV5");
    blueprint = await Blueprint.deploy();
    blueprint.initialize("Async Blueprint", "ABP", ContractOwner.address);
  });
  it("1.a: should update minter role", async function () {
    await blueprint.connect(ContractOwner).updateMinterAddress(user2.address);
    await blueprint
      .connect(user2)
      .prepareBlueprint(
        testArtist.address,
        tenThousandPieces,
        oneEth,
        zeroAddress,
        testHash,
        testUri,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        0,
        0,
        0
      );
    await blueprint
      .connect(user2)
      .setFeeRecipients(0, feeRecipients, feeBps, [], []);
    let result = await blueprint.blueprints(0);
    expect(result.artist).to.be.equal(testArtist.address);
  });

  it("1.b: should update platform address", async function () {
    await blueprint.connect(ContractOwner).updatePlatformAddress(user2.address);

    let platformAddress = await blueprint.platform();

    expect(platformAddress).to.be.equal(user2.address);
  });
  it("2.a: should allow for updating baseUri", async function () {
    await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        testArtist.address,
        tenThousandPieces,
        oneEth,
        zeroAddress,
        testHash,
        testUri,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        0,
        0,
        0
      );
    await blueprint
      .connect(ContractOwner)
      .setFeeRecipients(0, feeRecipients, feeBps, [], []);
    let updatedUri = "http://updatedUri/";
    await blueprint.connect(ContractOwner).updateMinterAddress(user2.address);
    await blueprint
      .connect(user2)
      .updateBlueprintTokenUri(0, updatedUri);
    let result = await blueprint.blueprints(0);
    await expect(result.baseTokenUri).to.be.equal(updatedUri);
  });
  it("2.b: should not allow for updating baseUri for unprepared blueprint", async function () {
    let updatedUri = "http://updatedUri/";
    await expect(
      blueprint.connect(ContractOwner).updateBlueprintTokenUri(0, updatedUri)
    ).to.be.revertedWith("blueprint not prepared");
  });
  it("2.c: should lock token URI", async function () {
    await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        testArtist.address,
        tenThousandPieces,
        oneEth,
        zeroAddress,
        testHash,
        testUri,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        0,
        0,
        0
      );
    await blueprint
      .connect(ContractOwner)
      .setFeeRecipients(0, feeRecipients, feeBps, [], []);
    let updatedUri = "http://updatedUri/";

    await blueprint.connect(ContractOwner).lockBlueprintTokenUri(0);
    await expect(
      blueprint.connect(ContractOwner).updateBlueprintTokenUri(0, updatedUri)
    ).to.be.revertedWith("blueprint URI locked");
  });
  // it("2.d: should allow platform to update base token uri", async function () {
  //   await blueprint
  //     .connect(ContractOwner)
  //     .prepareBlueprint(
  //       testArtist.address,
  //       tenThousandPieces,
  //       oneEth,
  //       zeroAddress,
  //       testHash,
  //       testUri,
  //       "0x0000000000000000000000000000000000000000000000000000000000000000",
  //       0,
  //       0,
  //       0
  //     );
  //   await blueprint
  //     .connect(ContractOwner)
  //     .setFeeRecipients(0, feeRecipients, feeBps, [], []);

  //   await blueprint
  //     .connect(ContractOwner)
  //     .setBaseTokenUri("https://test.baseUri");

  //   let contractBaseUri = await blueprint.baseTokenUri();

  //   expect(contractBaseUri).to.be.equal("https://test.baseUri");
  // });
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
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        0,
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
      .changeDefaultPlatformPrimaryFeePercentage(6000);
    let result = await blueprint.defaultPlatformPrimaryFeePercentage();
    expect(result.toString()).to.be.equal(BigNumber.from(6000).toString());
  });
  it("7: should not allow owner to change default Platform Fee Percentage above 10000", async function () {
    await expect(
      blueprint
        .connect(ContractOwner)
        .changeDefaultPlatformPrimaryFeePercentage(10600)
    ).to.be.revertedWith("");
  });
  it("8: should allow owner to change default  Secondary Fee Percentage", async function () {
    await blueprint
      .connect(ContractOwner)
      .changeDefaultBlueprintSecondarySalePercentage(3000);
    let result = await blueprint.defaultBlueprintSecondarySalePercentage();
    expect(result.toString()).to.be.equal(BigNumber.from(3000).toString());
  });
  it("9: should not allow owner to change default  Secondary Fee Percentage above 10000", async function () {
    await expect(
      blueprint
        .connect(ContractOwner)
        .changeDefaultBlueprintSecondarySalePercentage(10600)
    ).to.be.revertedWith("");
  });
  it("10: should allow owner to change default Platform Secondary Fee Percentage", async function () {
    await blueprint
      .connect(ContractOwner)
      .changeDefaultPlatformSecondarySalePercentage(3000);
    let result = await blueprint.defaultPlatformSecondarySalePercentage();
    expect(result.toString()).to.be.equal(BigNumber.from(3000).toString());
  });
  it("11: should not allow owner to change default Platform Secondary Fee Percentage above 10000", async function () {
    await expect(
      blueprint
        .connect(ContractOwner)
        .changeDefaultPlatformSecondarySalePercentage(10600)
    ).to.be.revertedWith("");
  });
});
