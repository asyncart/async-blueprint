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

describe("Prepare Blueprint Tests", function () {
  let Blueprint;
  let blueprint;
  let feeRecipients;
  let feeBps;

  beforeEach(async function () {
    [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
      await ethers.getSigners();

    feeRecipients = [ContractOwner.address, user1.address];
    feeBps = [1000, 9000];

    Blueprint = await ethers.getContractFactory("Blueprint");
    blueprint = await Blueprint.deploy();
    blueprint.initialize("Async Blueprint", "ABP");
  });
  it("1: should prepare the blueprint", async function () {
    await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        user1.address,
        tenThousandPieces,
        oneEth,
        zeroAddress,
        testHash,
        testUri,
        feeRecipients,
        feeBps
      );

    let result = await blueprint.blueprints(0);
    expect(result.saleState.toString()).to.be.equal(
      BigNumber.from(1).toString()
    );
    expect(result.artist).to.be.equal(user1.address);
    expect(result.price.toString()).to.be.equal(oneEth.toString());
    expect(result.capacity.toString()).to.be.equal(
      BigNumber.from(tenThousandPieces).toString()
    );
    expect(result.erc721TokenIndex.toString()).to.be.equal(zero);
    expect(result.randomSeedSigHash).to.be.equal(testHash);
    expect(result.baseTokenUri).to.be.equal(testUri);
  });
  it("2: should allow user to not specify fees", async function () {
    let emptyFeeRecipients = [];
    let emptyFeePercentages = [];

    await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        user1.address,
        tenThousandPieces,
        oneEth,
        zeroAddress,
        testHash,
        testUri,
        emptyFeeRecipients,
        emptyFeePercentages
      );
    let result = await blueprint.blueprints(0);
    await expect(result.artist).to.be.equal(user1.address);
  });
  it("3: should not allow mismatched fee recipients", async function () {
    let misFeeRecips = [user1.address];
    await expect(
      blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          user1.address,
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          misFeeRecips,
          feeBps
        )
    ).to.be.revertedWith("mismatched recipients & Bps");
  });
});
