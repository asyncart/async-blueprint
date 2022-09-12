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
const testPlatformArtistMintQuantity = 15;
const testArtistArtistMintQuantity = 17;
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
    let SplitMain;
    let splitMain; 
    let blueprint;
    let feesInput = {
      primaryFeeBPS: [],
      primaryFeeRecipients: [],
      secondaryFeesInput: {
        secondaryFeeRecipients: [],
        secondaryFeeMPS: [],
        totalRoyaltyCutBPS: 1000,
        royaltyRecipient: zeroAddress
      },
      deploySplit: false
    }

    beforeEach(async function () {
      [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
        await ethers.getSigners();

      feesInput.primaryFeeRecipients = [ContractOwner.address, testArtist.address];
      feesInput.primaryFeeBPS = [1000, 9000];
      feesInput.secondaryFeesInput.secondaryFeeRecipients = [ContractOwner.address, testArtist.address];
      feesInput.secondaryFeesInput.secondaryFeeMPS = [100000, 900000]    

      Blueprint = await ethers.getContractFactory("BlueprintV12");
      blueprint = await Blueprint.deploy();
      SplitMain = await ethers.getContractFactory("SplitMain");
      splitMain = await SplitMain.deploy();
      blueprint.initialize("Async Blueprint", "ABP", ContractOwner.address, ContractOwner.address, splitMain.address);
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
          testArtistArtistMintQuantity,
          testPlatformArtistMintQuantity,
          testMaxPurchaseAmount,
          0,
          feesInput
        );
    });
    it("1: Should allow the platform to mint presale", async function () {
      await blueprint
        .connect(ContractOwner)
        .artistMint(0, testPlatformArtistMintQuantity);
      let result = await blueprint.blueprints(0);
      let expectedCap = oneThousandPieces - testPlatformArtistMintQuantity;
      expect(result.capacity.toString()).to.be.equal(
        BigNumber.from(expectedCap).toString()
      );
      //should end on the next index
      //this user owns 0 - 9, next user will own 10 - x
      expect(result.erc721TokenIndex.toString()).to.be.equal(
        BigNumber.from(testPlatformArtistMintQuantity).toString()
      );
      let platformBalance = await blueprint.balanceOf(ContractOwner.address);
      expect(platformBalance).to.be.equal(testPlatformArtistMintQuantity);
    });
    it("2: Should allow the artist to mint presale", async function () {
      await blueprint
        .connect(testArtist)
        .artistMint(0, testArtistArtistMintQuantity);
      let result = await blueprint.blueprints(0);
      let expectedCap = oneThousandPieces - testArtistArtistMintQuantity;
      expect(result.capacity.toString()).to.be.equal(
        BigNumber.from(expectedCap).toString()
      );
      //should end on the next index
      //this user owns 0 - 9, next user will own 10 - x
      expect(result.erc721TokenIndex.toString()).to.be.equal(
        BigNumber.from(testArtistArtistMintQuantity).toString()
      );
      let platformBalance = await blueprint.balanceOf(testArtist.address);
      expect(platformBalance).to.be.equal(testArtistArtistMintQuantity);
    });
    it("3: Should not allow the platform to mint more than allocation", async function () {
      await expect(
        blueprint
          .connect(ContractOwner)
          .artistMint(0, testPlatformArtistMintQuantity + 1)
      ).to.be.revertedWith("can't mint quantity");
    });
    it("4: Should not allow the artist to mint more than allocation", async function () {
      await expect(
        blueprint
          .connect(testArtist)
          .artistMint(0, testArtistArtistMintQuantity + 1)
      ).to.be.revertedWith("can't mint quantity");
    });
    it("5: Should not allow other user to mint preSale", async function () {
      await expect(
        blueprint.connect(user1).artistMint(0, testArtistArtistMintQuantity)
      ).to.be.revertedWith("user cannot mint presale");
    });
    it("6: Should allow presale mint once sale started", async function () {
      await blueprint.connect(ContractOwner).beginSale(0);
      await blueprint
          .connect(testArtist)
          .artistMint(0, testArtistArtistMintQuantity);
      let result = await blueprint.blueprints(0);
      let expectedCap = oneThousandPieces - testArtistArtistMintQuantity;
      expect(result.capacity.toString()).to.be.equal(
        BigNumber.from(expectedCap).toString()
      );
      //should end on the next index
      //this user owns 0 - 9, next user will own 10 - x
      expect(result.erc721TokenIndex.toString()).to.be.equal(
        BigNumber.from(testArtistArtistMintQuantity).toString()
      );
      let platformBalance = await blueprint.balanceOf(testArtist.address);
      expect(platformBalance).to.be.equal(testArtistArtistMintQuantity);
    });
    it("7: Should not allow presale mint when sale paused", async function () {
      await blueprint.connect(ContractOwner).beginSale(0);
      await blueprint.connect(ContractOwner).pauseSale(0);
      await expect(
        blueprint
          .connect(testArtist)
          .artistMint(0, testArtistArtistMintQuantity)
      ).to.be.revertedWith("Must be presale or public sale");
    });
  });
});
