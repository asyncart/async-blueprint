const mapping = require("./merkle_mapping.json");
const { expect } = require("chai");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const { BigNumber } = require("ethers");

const oneEth = BigNumber.from("1000000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const testUri = "https://randomUri/";
const testHash = "fbejgnvnveorjgnt";
const tenThousandPieces = 10000;
const zero = BigNumber.from(0).toString();

const emptyFeeRecipients = [];
const emptyFeePercentages = [];

function hashToken(account, quantity) {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, quantity])
      .slice(2),
    "hex"
  );
}

describe("Prepare Blueprint", function () {
  before(async function () {
    console.log("A");
    this.accounts = await ethers.getSigners();
    this.merkleTree = new MerkleTree(
      Object.entries(mapping).map((mapping) => hashToken(...mapping)),
      keccak256,
      { sortPairs: true }
    );
  });
  describe("A: Blueprint prepation tests", function () {
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
    it("1: should prepare the blueprint", async function () {
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
          this.merkleTree.getHexRoot(),
          0,
          0
        );

      let result = await blueprint.blueprints(0);
      expect(result.saleState.toString()).to.be.equal(
        BigNumber.from(1).toString()
      );
      expect(result.artist).to.be.equal(testArtist.address);
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
          testArtist.address,
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          emptyFeeRecipients,
          emptyFeePercentages,
          this.merkleTree.getHexRoot(),
          0,
          0
        );
      let result = await blueprint.blueprints(0);
      await expect(result.artist).to.be.equal(testArtist.address);
    });
    it("3: should not allow mismatched fee recipients", async function () {
      let misFeeRecips = [testArtist.address];
      await expect(
        blueprint
          .connect(ContractOwner)
          .prepareBlueprint(
            testArtist.address,
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            misFeeRecips,
            feeBps,
            this.merkleTree.getHexRoot(),
            0,
            0
          )
      ).to.be.revertedWith("mismatched recipients & Bps");
    });
    it("4: should not allow fee bps to exceed 10000", async function () {
      let mismatchBps = [5000, 6000];
      await expect(
        blueprint
          .connect(ContractOwner)
          .prepareBlueprint(
            testArtist.address,
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            feeRecipients,
            mismatchBps,
            this.merkleTree.getHexRoot(),
            0,
            0
          )
      ).to.be.revertedWith("Fee Bps exceed maximum");
    });
    it("5: should not allow sale for unprepared blueprint", async function () {
      await expect(
        blueprint.connect(ContractOwner).beginSale(0)
      ).to.be.revertedWith("sale started or not prepared");
    });
  });
});
