// Test both BlueprintV12 and CreatorBlueprint prepareBlueprint external function

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
const emptyFeesInput = {
  primaryFeeBPS: [],
  primaryFeeRecipients: [],
  secondaryFeesInput: {
    secondaryFeeRecipients: [],
    secondaryFeeMPS: [],
    totalRoyaltyCutBPS: 0,
    royaltyRecipient: zeroAddress
  },
  deploySplit: false
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
    let SplitMain;
    let splitMain; 
    let blueprint;
    let CreatorBlueprint;
    let creatorBlueprint;
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
    let creatorFeeAllocationBPS = 500

    beforeEach(async function () {
      [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
        await ethers.getSigners();

      feesInput.primaryFeeRecipients = [ContractOwner.address, testArtist.address];
      feesInput.primaryFeeBPS = [1000, 9000];
      feesInput.secondaryFeesInput.secondaryFeeRecipients = [ContractOwner.address, testArtist.address];
      feesInput.secondaryFeesInput.secondaryFeeMPS = [100000, 900000]    

      // deploy blueprints v12
      Blueprint = await ethers.getContractFactory("BlueprintV12");
      blueprint = await Blueprint.deploy();

      // deploy the royalty splitter
      SplitMain = await ethers.getContractFactory("SplitMain");
      splitMain = await SplitMain.deploy();

      // initialize the per creator blueprint contract
      CreatorBlueprint = await ethers.getContractFactory("CreatorBlueprints");
      creatorBlueprint = await CreatorBlueprint.deploy(); 

      // initialize the per creator blueprint contract
      creatorBlueprint.initialize(["Steve's Blueprint", "ABP", "https://async.art/steve-metadata", testArtist.address], [ContractOwner.address, ContractOwner.address, ContractOwner.address], [splitMain.address, creatorFeeAllocationBPS], testPlatform.address);

      // initialize the global blueprints contract
      blueprint.initialize("Async Blueprint", "ABP", [ContractOwner.address, ContractOwner.address, ContractOwner.address], splitMain.address);
    });
    describe("1: should prepare the blueprint", function () {
      function assertBlueprintMatchesExpectation(result, isCreatorBlueprint = false) {
        if (!isCreatorBlueprint) {
          expect(result.artist).to.be.equal(testArtist.address);
        }
        expect(result.saleState.toString()).to.be.equal(
          BigNumber.from(1).toString()
        );
        expect(result.price.toString()).to.be.equal(oneEth.toString());
        expect(result.capacity.toString()).to.be.equal(
          BigNumber.from(tenThousandPieces).toString()
        );
        expect(result.erc721TokenIndex.toString()).to.be.equal(zero);
        expect(result.baseTokenUri).to.be.equal(testUri);
        expect(result.saleEndTimestamp.toString()).to.be.equal(zero);
      }
      it("BlueprintV12", async function() {
        await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          [
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            BigNumber.from(0)
          ],
          feesInput
        );
        let result = await blueprint.blueprints(0);
        assertBlueprintMatchesExpectation(result);
      });
      it("CreatorBlueprint", async function() {
        await creatorBlueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          [
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            BigNumber.from(0)
          ],
          [
            [1000, 9000],
            [ContractOwner.address, testArtist.address]
          ]
        );
        let result = await creatorBlueprint.blueprint();
        assertBlueprintMatchesExpectation(result, true);
      });
    });
    describe("should not allow timestamp to be a value in the past", function () {
      it("BlueprintV12", async function () {
        await expect(
          blueprint
            .connect(ContractOwner)
            .prepareBlueprint(
              testArtist.address,
              [
                tenThousandPieces,
                oneEth,
                zeroAddress,
                testHash,
                testUri,
                this.merkleTree.getHexRoot(),
                0,
                0,
                0,
                BigNumber.from(1)
              ],
              emptyFeesInput
            )
        ).to.be.revertedWith("ended");
      });
      it("CreatorBlueprint", async function () {
        await expect(
          creatorBlueprint
            .connect(ContractOwner)
            .prepareBlueprint(
              [
                tenThousandPieces,
                oneEth,
                zeroAddress,
                testHash,
                testUri,
                this.merkleTree.getHexRoot(),
                0,
                0,
                0,
                BigNumber.from(1)
              ],
              [
                [],
                []
              ]
            )
        ).to.be.revertedWith("ended");
      });
    });
    describe("should allow timestamp to be a value in the future", function () {
      const saleEndTimestamp = BigNumber.from(Date.now()).div(1000).add(100000);
      it("BlueprintV12", async function() {
        await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          [
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            BigNumber.from(saleEndTimestamp)
          ],
          emptyFeesInput
        )
        let result = await blueprint.blueprints(0);
        expect(result.saleEndTimestamp.toString()).to.be.equal(saleEndTimestamp.toString());
      });
      it("CreatorBlueprints", async function() {
        await creatorBlueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          [
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            BigNumber.from(saleEndTimestamp)
          ],
          [[],[]]
        )
        let result = await creatorBlueprint.blueprint();
        expect(result.saleEndTimestamp.toString()).to.be.equal(saleEndTimestamp.toString());
      });
    });
    describe("should allow user to not specify fees", function () {
      it("BlueprintV12", async function() {
        await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          [
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            BigNumber.from(0)
          ],
          emptyFeesInput
        );
        let result = await blueprint.blueprints(0);
        await expect(result.artist).to.be.equal(testArtist.address);
      });

      it("CreatorBlueprint", async function() {
        await creatorBlueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          [
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            BigNumber.from(0)
          ],
          [[],[]]
        );
        let result = await creatorBlueprint.blueprint();
        expect(result.price.toString()).to.be.equal(oneEth.toString());
      });
    });
    describe("should not allow mismatched fee recipients", function () {
      it("BlueprintV12", async function() {
        let misFeeRecips = [testArtist.address];
        await blueprint
          .connect(ContractOwner)
          .prepareBlueprint(
            testArtist.address,
            [
              tenThousandPieces,
              oneEth,
              zeroAddress,
              testHash,
              testUri,
              this.merkleTree.getHexRoot(),
              0,
              0,
              0,
              BigNumber.from(0)
            ],
            emptyFeesInput
          );
          
        await expect(
          blueprint
            .connect(ContractOwner)
            .setFeeRecipients(0, { ...feesInput, primaryFeeRecipients: misFeeRecips })
        ).to.be.revertedWith("invalid");
      });

      it("CreatorBlueprint", async function() {
        let misFeeRecips = [testArtist.address];
        await creatorBlueprint
          .connect(ContractOwner)
          .prepareBlueprint(
            [
              tenThousandPieces,
              oneEth,
              zeroAddress,
              testHash,
              testUri,
              this.merkleTree.getHexRoot(),
              0,
              0,
              0,
              BigNumber.from(0)
            ],
            [[],[]]
          );
          
        await expect(
          creatorBlueprint
            .connect(ContractOwner)
            .setFeeRecipients([[], misFeeRecips])
        ).to.be.revertedWith("invalid");
      });
    });
    describe("should not allow fee bps to exceed 10000", function () {
      it("BlueprintV12", async function() {
        let mismatchBps = [5000, 6000];
        await blueprint
          .connect(ContractOwner)
          .prepareBlueprint(
            testArtist.address,
            [
              tenThousandPieces,
              oneEth,
              zeroAddress,
              testHash,
              testUri,
              this.merkleTree.getHexRoot(),
              0,
              0,
              0,
              BigNumber.from(0)
            ],
            emptyFeesInput
          );
        await expect(
          blueprint
            .connect(ContractOwner)
            .setFeeRecipients(0, { ...feesInput, primaryFeeBPS: mismatchBps })
        ).to.be.revertedWith("bps >");
      });
      it("CreatorBlueprint", async function() {
        await creatorBlueprint
          .connect(ContractOwner)
          .prepareBlueprint(
            [
              tenThousandPieces,
              oneEth,
              zeroAddress,
              testHash,
              testUri,
              this.merkleTree.getHexRoot(),
              0,
              0,
              0,
              BigNumber.from(0)
            ],
            [[],[]]
          );
        await expect(
          creatorBlueprint
            .connect(ContractOwner)
            .setFeeRecipients([[5000, 6000], [testArtist.address, ContractOwner.address]])
        ).to.be.revertedWith("bps >");
      });
    });
    describe("should not allow sale for unprepared blueprint", function () {
      it("BlueprintV12", async function() {
        await expect(
          blueprint.connect(ContractOwner).beginSale(0)
        ).to.be.revertedWith("started");
      });
      it("CreatorBlueprint", async function() {
        await expect(
          creatorBlueprint.connect(ContractOwner).beginSale()
        ).to.be.revertedWith("started");
      });
    });
  });
});