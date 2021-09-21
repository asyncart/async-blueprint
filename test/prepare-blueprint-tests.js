const { expect } = require("chai");

const { BigNumber } = require("ethers");

const oneEth = BigNumber.from("1000000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const testUri = "https://randomUri/";
const testHash = "fbejgnvnveorjgnt";

describe("Prepare Blueprint Tests", function () {
  let Blueprint;
  let blueprint;

  beforeEach(async function () {
    [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
      await ethers.getSigners();

    Blueprint = await ethers.getContractFactory("Blueprint");
    blueprint = await Blueprint.deploy();
    blueprint.initialize("Async Blueprint", "ABP");
  });
  it("1: should prepare the blueprint", async function () {
    await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        user1.address,
        1000,
        oneEth,
        zeroAddress,
        testHash,
        testUri
      );

    let result = await blueprint.blueprints(0);
    expect(result.saleState.toString()).to.be.equal(
      BigNumber.from(1).toString()
    );
    expect(result.artist).to.be.equal(user1.address);
  });
});
