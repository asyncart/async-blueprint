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
const emptyFeeRecipients = {
  primaryFeeBPS: [],
  secondaryFeeBPS: [],
  primaryFeeRecipients: [],
  secondaryFeeRecipients: []
}

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
    this.accounts = await ethers.getSigners();
    this.merkleTree = new MerkleTree(
      Object.entries(mapping).map((mapping) => hashToken(...mapping)),
      keccak256,
      { sortPairs: true }
    );
  });
  describe("A: Basic Blueprint Sale ERC20 Tests", function () {
    let Blueprint;
    let SplitMain;
    let splitMain; 
    let blueprint;
    let CreatorBlueprint;
    let creatorBlueprint;

    let Erc20;
    let erc20;

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
    let creatorFeeAllocationBPS = 500;

    beforeEach(async function () {
      [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
        await ethers.getSigners();

      feesInput.primaryFeeRecipients = [ContractOwner.address, testArtist.address];
      feesInput.primaryFeeBPS = [1000, 9000];
      feesInput.secondaryFeesInput.secondaryFeeRecipients = [ContractOwner.address, testArtist.address];
      feesInput.secondaryFeesInput.secondaryFeeMPS = [100000, 900000]

      // deploy global blueprints
      Blueprint = await ethers.getContractFactory("BlueprintV12");
      blueprint = await Blueprint.deploy();

      // deploy royalty splitter
      SplitMain = await ethers.getContractFactory("SplitMain");
      splitMain = await SplitMain.deploy();

      // initialize the per creator blueprint contract
      CreatorBlueprint = await ethers.getContractFactory("contracts/contracts/CreatorBlueprints/contractVersions/CreatorBlueprints.sol:CreatorBlueprints");
      creatorBlueprint = await CreatorBlueprint.deploy(); 

      // deploy erc20 mock
      Erc20 = await ethers.getContractFactory("ERC20MockContract");
      erc20 = await Erc20.deploy("mock erc20", "mrc");

      await erc20.connect(ContractOwner).mint(user2.address, oneThousandTokens.mul(2));

      await erc20.connect(user2).approve(blueprint.address, oneThousandTokens);

      await erc20.connect(user2).approve(creatorBlueprint.address, oneThousandTokens);

      await erc20.connect(ContractOwner).mint(user1.address, oneThousandTokens.mul(2));

      await erc20.connect(user1).approve(blueprint.address, oneThousandTokens);

      await erc20.connect(user1).approve(creatorBlueprint.address, oneThousandTokens);

      // initialize the per creator blueprint contract
      creatorBlueprint.initialize(["Steve's Blueprint", "ABP", "https://async.art/steve-metadata", testArtist.address], [ContractOwner.address, ContractOwner.address, ContractOwner.address], [splitMain.address, creatorFeeAllocationBPS], testPlatform.address);

      // prepare a blueprint on the creator contract
      await creatorBlueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          [
            fiveHundredPieces,
            oneEth,
            erc20.address,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            0
          ],
          [[1000, 9000], [ContractOwner.address, testArtist.address]]
        );

      blueprint.initialize("Async Blueprint", "ABP", [ContractOwner.address, ContractOwner.address, ContractOwner.address], splitMain.address);
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          [
            fiveHundredPieces,
            oneEth,
            erc20.address,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            0
          ],
          feesInput
        );
    });
    describe("with sale started", function() {
      beforeEach(async function () {
        await creatorBlueprint.connect(ContractOwner).beginSale();
        await blueprint.connect(ContractOwner).beginSale(0);
      })
      describe("1: should begin sale of blueprint", function () {
        it("BlueprintV12", async function () {
          let result = await blueprint.blueprints(0);
          expect(result.saleState.toString()).to.be.equal(
            BigNumber.from(2).toString()
          );
          let erc721Index = await blueprint.latestErc721TokenIndex();
          expect(erc721Index.toString()).to.be.equal(
            BigNumber.from(fiveHundredPieces).toString()
          );
        });
        it("CreatorBlueprint", async function () {
          let result = await creatorBlueprint.blueprint();
          expect(result.saleState.toString()).to.be.equal(
            BigNumber.from(2).toString()
          );
          let erc721Index = await creatorBlueprint.latestErc721TokenIndex();
          expect(erc721Index.toString()).to.be.equal(
            BigNumber.from(fiveHundredPieces).toString()
          );
        });
      });
      describe("2: should allow for pausing of sale", function () {
        it("BlueprintV12", async function () {
          await blueprint.connect(ContractOwner).pauseSale(0);
          let result = await blueprint.blueprints(0);
          expect(result.saleState.toString()).to.be.equal(sale_paused);
        });
        it("CreatorBlueprint", async function () {
          await creatorBlueprint.connect(ContractOwner).pauseSale();
          let result = await creatorBlueprint.blueprint();
          expect(result.saleState.toString()).to.be.equal(sale_paused);
        });
      });
      describe("3: should allow for unpausing of paused sale", function () {
        it("BlueprintV12", async function () {
          await blueprint.connect(ContractOwner).pauseSale(0);
          await blueprint.connect(ContractOwner).unpauseSale(0);
          let result = await blueprint.blueprints(0);
          expect(result.saleState.toString()).to.be.equal(sale_started);
        });
        it("CreatorBlueprint", async function () {
          await creatorBlueprint.connect(ContractOwner).pauseSale();
          await creatorBlueprint.connect(ContractOwner).unpauseSale();
          let result = await creatorBlueprint.blueprint();
          expect(result.saleState.toString()).to.be.equal(sale_started);
        });
      });
      describe("5: should allow users to purchase blueprints", function () {
        it("BlueprintV12", async function () {
          await blueprint
            .connect(user2)
            .purchaseBlueprints(0, tenPieces, tenPieces, tenEth, []);
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
        it("CreatorBlueprint", async function () {
          await creatorBlueprint
            .connect(user2)
            .purchaseBlueprints(tenPieces, tenPieces, tenEth, []);
          let result = await creatorBlueprint.blueprint();
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
      });
      describe("sale and purchase methods", async function () {
        describe("1: should distribute fees", function () {
          it("BlueprintV12", async function () {
            let ownerBal = await erc20.balanceOf(ContractOwner.address);
            let artistBal = await erc20.balanceOf(testArtist.address);
    
            await blueprint
              .connect(user2)
              .purchaseBlueprints(0, tenPieces, tenPieces, tenEth, []);
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
          it("CreatorBlueprints", async function () {
            let ownerBal = await erc20.balanceOf(ContractOwner.address);
            let artistBal = await erc20.balanceOf(testArtist.address);
    
            await creatorBlueprint
              .connect(user2)
              .purchaseBlueprints(tenPieces, tenPieces, tenEth, []);
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
        });
        describe("2: should not allow user to specify an Eth amount", function () {
          it("BlueprintV12", async function() {
            await expect(
              blueprint
                .connect(user2)
                .purchaseBlueprints(0, tenPieces, tenPieces, 10, [], { value: 10 })
            ).to.be.revertedWith("eth value != 0");
          });
          it("Creator Blueprint", async function() {
            await expect(
              creatorBlueprint
                .connect(user2)
                .purchaseBlueprints(tenPieces, tenPieces, 10, [], { value: 10 })
            ).to.be.revertedWith("eth value != 0");
          });
        });
        describe("3: should not allow purchase of more than capacity", function () {
          it("BlueprintV12", async function() {
            let fiveHundredEth = fiveHundredPieces.mul(oneEth);
            await blueprint
              .connect(user1)
              .purchaseBlueprints(0, fiveHundredPieces, fiveHundredPieces, fiveHundredEth, []);
    
            await expect(
              blueprint
                .connect(user2)
                .purchaseBlueprints(
                  0,
                  fiveHundredPieces.add(BigNumber.from(1)),
                  fiveHundredPieces.add(BigNumber.from(1)),
                  fiveHundredEth.add(oneEth),
                  []
                )
            ).to.be.revertedWith("quantity >");
          });
          it("Creator Blueprint", async function() {
            let fiveHundredEth = fiveHundredPieces.mul(oneEth);
            await creatorBlueprint
              .connect(user1)
              .purchaseBlueprints(fiveHundredPieces, fiveHundredPieces, fiveHundredEth, []);
    
            await expect(
              creatorBlueprint
                .connect(user2)
                .purchaseBlueprints(
                  fiveHundredPieces.add(BigNumber.from(1)),
                  fiveHundredPieces.add(BigNumber.from(1)),
                  fiveHundredEth.add(oneEth),
                  []
                )
            ).to.be.revertedWith("quantity >");
          });
        });
        describe("4: should not allow sale for less than price", async function () {
          it("BlueprintV12", async function() {
            await expect(
              blueprint.connect(user2).purchaseBlueprints(0, tenPieces, tenPieces, oneEth, [])
            ).to.be.revertedWith("$ != expected");
          });
          it("Creator Blueprint", async function() {
            await expect(
              creatorBlueprint.connect(user2).purchaseBlueprints(tenPieces, tenPieces, oneEth, [])
            ).to.be.revertedWith("$ != expected");
          });
        });
      })
    });

    describe("without sale started", function() {
      describe("4: should not allow pausing of unstarted sale", function () {
        it("BlueprintV12", async function () {
          await expect(
            blueprint.connect(ContractOwner).pauseSale(0)
          ).to.be.revertedWith("!ongoing");
        });
        it("CreatorBlueprint", async function () {
          await expect(
            creatorBlueprint.connect(ContractOwner).pauseSale()
          ).to.be.revertedWith("!ongoing");
        });
      });
    });
  });
});