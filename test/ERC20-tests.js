const mapping = require("./merkle_mapping.json");
const { expect } = require("chai");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const { BigNumber } = require("ethers");

const oneEth = BigNumber.from("10000000000000000000");
const tenEth = BigNumber.from("100000000000000000000");
const oneThousandTokens = BigNumber.from("10000000000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const testUri = "https://randomUri/";
const testHash = "fbejgnvnveorjgnt";
const tenThousandPieces = 10000;
const oneThousandPieces = 1000;
const zero = BigNumber.from(0).toString();
const fiveHundredPieces = BigNumber.from(oneThousandPieces).div(2);

const tenPieces = 10;

const sale_notPrepared = BigNumber.from(0).toString();
const sale_notStarted = BigNumber.from(1).toString();
const sale_started = BigNumber.from(2).toString();
const sale_paused = BigNumber.from(3).toString();

function hashToken(account, quantity) {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, quantity])
      .slice(2),
    "hex"
  );
}

describe("ERC20 interactions", function () {
  before(async function () {
    console.log("A");
    this.accounts = await ethers.getSigners();
    this.merkleTree = new MerkleTree(
      Object.entries(mapping).map((mapping) => hashToken(...mapping)),
      keccak256,
      { sortPairs: true }
    );
  });
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

      feeRecipients = [ContractOwner.address, testArtist.address];
      feeBps = [1000, 9000];

      Blueprint = await ethers.getContractFactory("Blueprint");
      blueprint = await Blueprint.deploy();

      Erc20 = await ethers.getContractFactory("ERC20MockContract");
      erc20 = await Erc20.deploy("mock erc20", "mrc");

      await erc20.connect(ContractOwner).mint(user2.address, oneThousandTokens);

      await erc20.connect(user2).approve(blueprint.address, oneThousandTokens);

      await erc20.connect(ContractOwner).mint(user1.address, oneThousandTokens);

      await erc20.connect(user1).approve(blueprint.address, oneThousandTokens);

      blueprint.initialize("Async Blueprint", "ABP");
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          fiveHundredPieces,
          oneEth,
          erc20.address,
          testHash,
          testUri,
          feeRecipients,
          feeBps,
          this.merkleTree.getHexRoot()
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
        BigNumber.from(fiveHundredPieces).toString()
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
          fiveHundredPieces,
          oneEth,
          zeroAddress,
          testHash + "dsfdk",
          testUri + "unpause_test",
          feeRecipients,
          feeBps,
          this.merkleTree.getHexRoot()
        );
      await expect(
        blueprint.connect(ContractOwner).pauseSale(1)
      ).to.be.revertedWith("Sale not started");
    });
    it("5: should allow users to purchase blueprints", async function () {
      let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
      await blueprint
        .connect(user2)
        .purchaseBlueprints(0, tenPieces, tenEth, []);
      let result = await blueprint.blueprints(0);
      let expectedCap = fiveHundredPieces - tenPieces;
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
        let artistBal = await erc20.balanceOf(testArtist.address);

        await blueprint
          .connect(user2)
          .purchaseBlueprints(0, tenPieces, tenEth, []);
        let expectedAmount = BigNumber.from(ownerBal);
        let newOwnerBal = await erc20.balanceOf(ContractOwner.address);
        expect(newOwnerBal.toString()).to.be.equal(
          expectedAmount.add(oneEth).toString()
        );
        let expectedArtistReturn = oneEth.mul(BigNumber.from(9));
        let newArtistBal = await erc20.balanceOf(testArtist.address);
        expect(newArtistBal.toString()).to.be.equal(
          BigNumber.from(artistBal).add(expectedArtistReturn).toString()
        );
      });
      it("2: should not allow user to specify an Eth amount", async function () {
        let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
        await expect(
          blueprint
            .connect(user2)
            .purchaseBlueprints(0, tenPieces, 10, [], { value: 10 })
        ).to.be.revertedWith("cannot specify eth amount");
      });
      it("3: should not allow purchase of more than capacity", async function () {
        let fiveHundredEth = fiveHundredPieces.mul(oneEth);
        await blueprint
          .connect(user1)
          .purchaseBlueprints(0, fiveHundredPieces, fiveHundredEth, []);

        await expect(
          blueprint
            .connect(user2)
            .purchaseBlueprints(
              0,
              fiveHundredPieces.add(BigNumber.from(1)),
              fiveHundredEth.add(oneEth),
              []
            )
        ).to.be.revertedWith("quantity exceeds capacity");
      });
      it("4: should not allow sale for less than price", async function () {
        await expect(
          blueprint.connect(user2).purchaseBlueprints(0, tenPieces, oneEth, [])
        ).to.be.revertedWith("Purchase amount must match price");
      });
    });
  });
});
