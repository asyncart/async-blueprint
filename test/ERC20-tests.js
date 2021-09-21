const { expect } = require("chai");

const { BigNumber } = require("ethers");

const oneEth = BigNumber.from("10000000000000000000");
const tenEth = BigNumber.from("100000000000000000000");
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

describe("A: Basic Blueprint Sale ERC20 Tests", function () {
  let Blueprint;
  let blueprint;

  let Erc20;
  let erc20;

  let feeRecipients;
  let feeBps;

  beforeEach(async function () {
    [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
      await ethers.getSigners();

    feeRecipients = [ContractOwner.address, user1.address];
    feeBps = [1000, 9000];

    Blueprint = await ethers.getContractFactory("Blueprint");
    blueprint = await Blueprint.deploy();

    Erc20 = await ethers.getContractFactory("ERC20MockContract");
    erc20 = await Erc20.deploy("mock erc20", "mrc");

    await erc20.connect(ContractOwner).mint(user2.address, tenEth);

    await erc20.connect(user2).approve(blueprint.address, tenEth);

    blueprint.initialize("Async Blueprint", "ABP");
    await blueprint
      .connect(ContractOwner)
      .prepareBlueprint(
        user1.address,
        tenThousandPieces,
        oneEth,
        erc20.address,
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
    await blueprint.connect(user2).purchaseBlueprints(0, tenPieces, tenEth);
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
  describe("B: Sale + purchase interactions", async function () {
    it("1: should distribute fees", async function () {
      let ownerBal = await erc20.balanceOf(ContractOwner.address);
      let artistBal = await erc20.balanceOf(user1.address);

      await blueprint.connect(user2).purchaseBlueprints(0, tenPieces, tenEth);
      let expectedAmount = BigNumber.from(ownerBal);
      let newOwnerBal = await erc20.balanceOf(ContractOwner.address);
      expect(newOwnerBal.toString()).to.be.equal(
        expectedAmount.add(oneEth).toString()
      );
      let expectedArtistReturn = oneEth.mul(BigNumber.from(9));
      let newArtistBal = await erc20.balanceOf(user1.address);
      expect(newArtistBal.toString()).to.be.equal(
        BigNumber.from(artistBal).add(expectedArtistReturn).toString()
      );
    });
    it("2: should not allow user to specify an Eth amount", async function () {
      let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
      await expect(
        blueprint
          .connect(user2)
          .purchaseBlueprints(0, tenPieces, 10, { value: 10 })
      ).to.be.revertedWith("cannot specify eth amount");
    });
  });
});
