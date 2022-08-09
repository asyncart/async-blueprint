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
const emptyFeeRecipients = {
  primaryFeeBPS: [],
  secondaryFeeBPS: [],
  primaryFeeRecipients: [],
  secondaryFeeRecipients: []
}

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
    let feeRecipients = {
      primaryFeeBPS: [],
      secondaryFeeBPS: [],
      primaryFeeRecipients: [],
      secondaryFeeRecipients: []
    }

    beforeEach(async function () {
      [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
        await ethers.getSigners();

      feeRecipients.primaryFeeRecipients = [ContractOwner.address, testArtist.address];
      feeRecipients.primaryFeeBPS = [1000, 9000];

      Blueprint = await ethers.getContractFactory("BlueprintV12");
      blueprint = await Blueprint.deploy();
      blueprint.initialize("Async Blueprint", "ABP", ContractOwner.address);
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
          this.merkleTree.getHexRoot(),
          0,
          0,
          0,
          BigNumber.from(0),
          feeRecipients
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
      expect(result.baseTokenUri).to.be.equal(testUri);
      expect(result.saleEndTimestamp.toString()).to.be.equal(zero);
    });
    it("should not allow timestamp to be a value in the past", async function () {
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
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            BigNumber.from(1),
            emptyFeeRecipients
          )
      ).to.be.revertedWith("Sale ended");
    });
    it("should allow timestamp to be a value in the future", async function () {
      const saleEndTimestamp = BigNumber.from(Date.now()).div(1000).add(100000);
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          this.merkleTree.getHexRoot(),
          0,
          0,
          0,
          BigNumber.from(saleEndTimestamp),
          emptyFeeRecipients
        )
      let result = await blueprint.blueprints(0);
      expect(result.saleEndTimestamp.toString()).to.be.equal(saleEndTimestamp.toString());
    });
    it("should allow user to not specify fees", async function () {
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          this.merkleTree.getHexRoot(),
          0,
          0,
          0,
          BigNumber.from(0),
          emptyFeeRecipients
        );
      let result = await blueprint.blueprints(0);
      await expect(result.artist).to.be.equal(testArtist.address);
    });
    it("should not allow mismatched fee recipients", async function () {
      let misFeeRecips = [testArtist.address];
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          this.merkleTree.getHexRoot(),
          0,
          0,
          0,
          BigNumber.from(0),
          emptyFeeRecipients
        );
        
      await expect(
        blueprint
          .connect(ContractOwner)
          .setFeeRecipients(0, { ...feeRecipients, primaryFeeRecipients: misFeeRecips })
      ).to.be.revertedWith("mismatched recipients & Bps");
    });
    it("should not allow fee bps to exceed 10000", async function () {
      let mismatchBps = [5000, 6000];
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          this.merkleTree.getHexRoot(),
          0,
          0,
          0,
          BigNumber.from(0),
          emptyFeeRecipients
        );
      await expect(
        blueprint
          .connect(ContractOwner)
          .setFeeRecipients(0, { ...feeRecipients, primaryFeeBPS: mismatchBps })
      ).to.be.revertedWith("Fee Bps > maximum");
    });
    it("should not allow sale for unprepared blueprint", async function () {
      await expect(
        blueprint.connect(ContractOwner).beginSale(0)
      ).to.be.revertedWith("sale started or not prepared");
    });
  });
});