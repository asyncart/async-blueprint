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
const emptyFeeRecipients = {
  primaryFeeBPS: [],
  secondaryFeeBPS: [],
  primaryFeeRecipients: [],
  secondaryFeeRecipients: []
}
const testPlatformPreSaleMintQuantity = 15;
const testArtistPreSaleMintQuantity = 17;
const testMaxPurchaseAmount = 0;

function hashToken(account, quantity) {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [account, quantity])
      .slice(2),
    "hex"
  );
}

describe("Blueprint presale minting", function () {
  before(async function () {
    this.accounts = await ethers.getSigners();
    this.merkleTree = new MerkleTree(
      Object.entries(mapping).map((mapping) => hashToken(...mapping)),
      keccak256,
      { sortPairs: true }
    );
  });
  describe("A: Presale minting functionality tests", function () {
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
          testArtistPreSaleMintQuantity,
          testPlatformPreSaleMintQuantity,
          testMaxPurchaseAmount,
          0,
          feeRecipients
        );
    });
    it("1: Should allow the platform to mint presale", async function () {
      await blueprint
        .connect(ContractOwner)
        .preSaleMint(0, testPlatformPreSaleMintQuantity);
      let result = await blueprint.blueprints(0);
      let expectedCap = oneThousandPieces - testPlatformPreSaleMintQuantity;
      expect(result.capacity.toString()).to.be.equal(
        BigNumber.from(expectedCap).toString()
      );
      //should end on the next index
      //this user owns 0 - 9, next user will own 10 - x
      expect(result.erc721TokenIndex.toString()).to.be.equal(
        BigNumber.from(testPlatformPreSaleMintQuantity).toString()
      );
      let platformBalance = await blueprint.balanceOf(ContractOwner.address);
      expect(platformBalance).to.be.equal(testPlatformPreSaleMintQuantity);
    });
    it("2: Should allow the artist to mint presale", async function () {
      await blueprint
        .connect(testArtist)
        .preSaleMint(0, testArtistPreSaleMintQuantity);
      let result = await blueprint.blueprints(0);
      let expectedCap = oneThousandPieces - testArtistPreSaleMintQuantity;
      expect(result.capacity.toString()).to.be.equal(
        BigNumber.from(expectedCap).toString()
      );
      //should end on the next index
      //this user owns 0 - 9, next user will own 10 - x
      expect(result.erc721TokenIndex.toString()).to.be.equal(
        BigNumber.from(testArtistPreSaleMintQuantity).toString()
      );
      let platformBalance = await blueprint.balanceOf(testArtist.address);
      expect(platformBalance).to.be.equal(testArtistPreSaleMintQuantity);
    });
    it("3: Should not allow the platform to mint more than allocation", async function () {
      await expect(
        blueprint
          .connect(ContractOwner)
          .preSaleMint(0, testPlatformPreSaleMintQuantity + 1)
      ).to.be.revertedWith("cannot mint quantity");
    });
    it("4: Should not allow the artist to mint more than allocation", async function () {
      await expect(
        blueprint
          .connect(testArtist)
          .preSaleMint(0, testArtistPreSaleMintQuantity + 1)
      ).to.be.revertedWith("cannot mint quantity");
    });
    it("5: Should not allow other user to mint preSale", async function () {
      await expect(
        blueprint.connect(user1).preSaleMint(0, testArtistPreSaleMintQuantity)
      ).to.be.revertedWith("user cannot mint presale");
    });
    it("6: Should allow presale mint once sale started", async function () {
      await blueprint.connect(ContractOwner).beginSale(0);
      await blueprint
          .connect(testArtist)
          .preSaleMint(0, testArtistPreSaleMintQuantity);
      let result = await blueprint.blueprints(0);
      let expectedCap = oneThousandPieces - testArtistPreSaleMintQuantity;
      expect(result.capacity.toString()).to.be.equal(
        BigNumber.from(expectedCap).toString()
      );
      //should end on the next index
      //this user owns 0 - 9, next user will own 10 - x
      expect(result.erc721TokenIndex.toString()).to.be.equal(
        BigNumber.from(testArtistPreSaleMintQuantity).toString()
      );
      let platformBalance = await blueprint.balanceOf(testArtist.address);
      expect(platformBalance).to.be.equal(testArtistPreSaleMintQuantity);
    });
    it("7: Should not allow presale mint when sale paused", async function () {
      await blueprint.connect(ContractOwner).beginSale(0);
      await blueprint.connect(ContractOwner).pauseSale(0);
      await expect(
        blueprint
          .connect(testArtist)
          .preSaleMint(0, testArtistPreSaleMintQuantity)
      ).to.be.revertedWith("Must be presale or public sale");
    });
  });
});
