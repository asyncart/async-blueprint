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

    feeRecipients = [ContractOwner.address, user1.address];
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
    expect(result.artist).to.be.equal(user1.address);
  });
  it("2: should allow for updating baseUri", async function () {
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
    let updatedUri = "http://updatedUri/";
    await blueprint.connect(ContractOwner).updateBaseTokenUri(0, updatedUri);
    let result = await blueprint.blueprints(0);
    await expect(result.baseTokenUri).to.be.equal(updatedUri);
  });
});
