const mapping = require("./merkle_mapping.json");
const { expect } = require("chai");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const { BigNumber } = require("ethers");

const oneEth = BigNumber.from("1000000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const testUri = "https://randomUri/";
const testHash = "fbejgnvnveorjgnt";
const oneThousandPieces = 1000;
const zero = BigNumber.from(0).toString();

const tenPieces = 10;

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

describe("Blueprint Sales", function () {
  before(async function () {
    this.accounts = await ethers.getSigners();
    this.merkleTree = new MerkleTree(
      Object.entries(mapping).map((mapping) => hashToken(...mapping)),
      keccak256,
      { sortPairs: true }
    );
  });
  describe("A: Basic Blueprint sale tests", function () {
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
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          oneThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          this.merkleTree.getHexRoot(),
          0,
          0,
          0
        );
      await blueprint
        .connect(ContractOwner)
        .setFeeRecipients(0, feeRecipients, feeBps, [], []);
      await blueprint.connect(ContractOwner).beginSale(0);
    });
    it("1: should begin sale of blueprint", async function () {
      let result = await blueprint.blueprints(0);
      expect(result.saleState.toString()).to.be.equal(
        BigNumber.from(2).toString()
      );
      let erc721Index = await blueprint.latestErc721TokenIndex();
      expect(erc721Index.toString()).to.be.equal(
        BigNumber.from(oneThousandPieces).toString()
      );
    });
    it("2: should allow for pausing of sale", async function () {
      await blueprint.connect(ContractOwner).pauseSale(0);
      let result = await blueprint.blueprints(0);
      expect(result.saleState.toString()).to.be.equal(sale_paused);
      await expect(
        blueprint.connect(ContractOwner).pauseSale(0)
      ).to.be.revertedWith("Sale not started");
    });
    it("3: should allow for unpausing of paused sale", async function () {
      await blueprint.connect(ContractOwner).pauseSale(0);
      await blueprint.connect(ContractOwner).unpauseSale(0);
      let result = await blueprint.blueprints(0);
      expect(result.saleState.toString()).to.be.equal(sale_started);
      await expect(
        blueprint.connect(ContractOwner).unpauseSale(0)
      ).to.be.revertedWith("Sale not paused");
    });
    it("4: should not allow pausing of unstarted sale", async function () {
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          user2.address,
          oneThousandPieces,
          oneEth,
          zeroAddress,
          testHash + "dsfdk",
          testUri + "unpause_test",
          this.merkleTree.getHexRoot(),
          0,
          0,
          0
        );
      await expect(
        blueprint.connect(ContractOwner).pauseSale(1)
      ).to.be.revertedWith("Sale not started");
    });
    it("5: should allow users to purchase blueprints", async function () {
      let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
      await blueprint
        .connect(user2)
        .purchaseBlueprints(0, tenPieces, 0, [], { value: blueprintValue });
      let result = await blueprint.blueprints(0);
      let expectedCap = oneThousandPieces - tenPieces;
      expect(result.capacity.toString()).to.be.equal(
        BigNumber.from(expectedCap).toString()
      );
      //should end on the next index
      //this user owns 0 - 9, next user will own 10 - x
      expect(result.erc721TokenIndex.toString()).to.be.equal(
        BigNumber.from(tenPieces).toString()
      );
    });
    it("6: should not allow users to purchase blueprints if sale paused", async function () {
      await blueprint.connect(ContractOwner).pauseSale(0);
      let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
      await expect(
        blueprint
          .connect(user2)
          .purchaseBlueprints(0, tenPieces, 0, [], { value: blueprintValue })
      ).to.be.revertedWith("not available to purchase");
    });
    describe("B: Sale + purchase interactions", async function () {
      it("1: should distribute fees", async function () {
        let ownerBal = await ContractOwner.getBalance();
        let artistBal = await testArtist.getBalance();
        let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
        await blueprint
          .connect(user2)
          .purchaseBlueprints(0, tenPieces, 0, [], { value: blueprintValue });
        let expectedAmount = BigNumber.from(ownerBal);
        let newOwnerBal = await ContractOwner.getBalance();
        expect(newOwnerBal.toString()).to.be.equal(
          expectedAmount.add(oneEth).toString()
        );
        let expectedArtistReturn = oneEth.mul(9);
        let newArtistBal = await testArtist.getBalance();
        expect(newArtistBal.toString()).to.be.equal(
          BigNumber.from(artistBal).add(expectedArtistReturn).toString()
        );
      });
      it("2: should not allow user to specify an Erc20 amount", async function () {
        let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
        await expect(
          blueprint
            .connect(user2)
            .purchaseBlueprints(0, tenPieces, 10, [], { value: blueprintValue })
        ).to.be.revertedWith("cannot specify token amount");
      });
      it("3: should not allow purchase of more than capacity", async function () {
        let fiveHundredPieces = BigNumber.from(oneThousandPieces).div(2);
        let fiveHundredEth = fiveHundredPieces.mul(oneEth);
        await blueprint
          .connect(user1)
          .purchaseBlueprints(0, fiveHundredPieces, 0, [], {
            value: fiveHundredEth,
          });

        await expect(
          blueprint
            .connect(user2)
            .purchaseBlueprints(
              0,
              fiveHundredPieces.add(BigNumber.from(1)),
              0,
              [],
              { value: fiveHundredEth.add(oneEth) }
            )
        ).to.be.revertedWith("quantity exceeds capacity");
      });
      it("5: should default fees if none provided", async function () {
        await blueprint
          .connect(ContractOwner)
          .prepareBlueprint(
            testArtist.address,
            oneThousandPieces,
            oneEth,
            zeroAddress,
            testHash + "dsfdk",
            testUri + "_test",
            this.merkleTree.getHexRoot(),
            0,
            0,
            0
          );
        await blueprint.connect(ContractOwner).beginSale(1);
        await blueprint.setAsyncFeeRecipient(testPlatform.address);
        let testPlatformBal = await testPlatform.getBalance();
        let artistBal = await testArtist.getBalance();
        let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
        await blueprint
          .connect(user2)
          .purchaseBlueprints(1, tenPieces, 0, [], { value: blueprintValue });
        let expectedAmount = BigNumber.from(testPlatformBal);
        let newPlatformBal = await testPlatform.getBalance();
        expect(newPlatformBal.toString()).to.be.equal(
          expectedAmount.add(oneEth.mul(2)).toString()
        );
        let expectedArtistReturn = oneEth.mul(8);
        let newArtistBal = await testArtist.getBalance();
        expect(newArtistBal.toString()).to.be.equal(
          BigNumber.from(artistBal).add(expectedArtistReturn).toString()
        );
      });
      it("6: should allow display token URI", async function () {
        let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
        await blueprint
          .connect(user2)
          .purchaseBlueprints(0, tenPieces, 0, [], { value: blueprintValue });

        await blueprint
          .connect(ContractOwner)
          .updateBlueprintTokenUri(0, "https://test.baseUri");
        let tokenUri = await blueprint.tokenURI(1);

        await expect(tokenUri).to.be.equal("https://test.baseUri/1/token.json");
      });
    });
  });
});
