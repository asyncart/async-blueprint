const { expect } = require("chai");

const { BigNumber } = require("ethers");

const oneEth = BigNumber.from("1000000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const testUri = "https://randomUri/";
const testHash = "fbejgnvnveorjgnt";
const tenThousandPieces = 10000;
const zero = BigNumber.from(0).toString();

const tenPieces = 10;

const sale_notPrepared = BigNumber.from(0).toString();
const sale_notStarted = BigNumber.from(1).toString();
const sale_started = BigNumber.from(2).toString();
const sale_paused = BigNumber.from(3).toString();

describe("Basic Blueprint Sale Tests", function () {
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
    await blueprint.connect(ContractOwner).beginSale(0);
  });
  it("1: should begin sale of blueprint", async function () {
    let result = await blueprint.blueprints(0);
    expect(result.saleState.toString()).to.be.equal(
      BigNumber.from(2).toString()
    );
    let erc721Index = await blueprint.latestErc721TokenIndex();
    expect(erc721Index.toString()).to.be.equal(
      BigNumber.from(tenThousandPieces).toString()
    );
  });
  it("2: should allow for pausing of sale", async function () {
    await blueprint.connect(ContractOwner).pauseSale(0);
    let result = await blueprint.blueprints(0);
    expect(result.saleState.toString()).to.be.equal(sale_paused);
  });
  it("3: should allow for unpausing of paused sale", async function () {
    await blueprint.connect(ContractOwner).pauseSale(0);
    await blueprint.connect(ContractOwner).unpauseSale(0);
    let result = await blueprint.blueprints(0);
    expect(result.saleState.toString()).to.be.equal(sale_started);
  });
  it("4: should not allow pausing of unstarted sale", async function () {
    await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        user2.address,
        tenThousandPieces,
        oneEth,
        zeroAddress,
        testHash + "dsfdk",
        testUri + "unpause_test",
        feeRecipients,
        feeBps
      );
    await expect(
      blueprint.connect(ContractOwner).pauseSale(1)
    ).to.be.revertedWith("Sale not started");
  });
  it("5: should allow users to purchase blueprints", async function () {
    let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
    await blueprint
      .connect(user2)
      .purchaseBlueprints(0, tenPieces, 0, { value: blueprintValue });
    let result = await blueprint.blueprints(0);
    let expectedCap = tenThousandPieces - tenPieces;
    expect(result.capacity.toString()).to.be.equal(
      BigNumber.from(expectedCap).toString()
    );
    //should end on the next index
    //this user owns 0 - 9, next user will own 10 - x
    expect(result.erc721TokenIndex.toString()).to.be.equal(
      BigNumber.from(tenPieces).toString()
    );
  });
});
