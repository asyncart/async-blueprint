const mapping = require("./merkle_mapping.json");
const { expect } = require("chai");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");

const oneEth = BigNumber.from("1000000000000000000");
const zeroAddress = "0x0000000000000000000000000000000000000000";
const testUri = "https://randomUri/";
const testHash = "fbejgnvnveorjgnt";
const oneThousandPieces = 1000;
const tenPieces = 10;
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
    let SplitMain;
    let splitMain;
    let blueprint;
    let creatorBlueprint;
    let CreatorBlueprint;
    let creatorFeeAllocationBPS = 500;

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

      // initialize the per creator blueprint contract
      CreatorBlueprint = await ethers.getContractFactory("CreatorBlueprints");
      creatorBlueprint = await CreatorBlueprint.deploy(); 

      // initialize the per creator blueprint contract
      creatorBlueprint.initialize(["Steve's Blueprint", "ABP", "https://async.art/steve-metadata", testArtist.address], [ContractOwner.address, ContractOwner.address, ContractOwner.address], [splitMain.address, creatorFeeAllocationBPS], testPlatform.address);
      
      // prepare a blueprint on the creator contract
      await creatorBlueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          [
            oneThousandPieces,
            oneEth,
            zeroAddress,
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

      // initialize the global blueprints contract
      blueprint.initialize("Async Blueprint", "ABP", [ContractOwner.address, ContractOwner.address, ContractOwner.address], splitMain.address);
      
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          [
            oneThousandPieces,
            oneEth,
            zeroAddress,
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
      beforeEach(async function() {
        await blueprint.connect(ContractOwner).beginSale(0);
        await creatorBlueprint.connect(ContractOwner).beginSale();
      });
      describe("1: should begin sale of blueprint", function () {
        it("BlueprintV12", async function() {
          let result = await blueprint.blueprints(0);
          expect(result.saleState.toString()).to.be.equal(
            BigNumber.from(2).toString()
          );
          let erc721Index = await blueprint.latestErc721TokenIndex();
          expect(erc721Index.toString()).to.be.equal(
            BigNumber.from(oneThousandPieces).toString()
          );
        });
        it("CreatorBlueprint", async function() {
          let result = await creatorBlueprint.blueprint();
          expect(result.saleState.toString()).to.be.equal(
            BigNumber.from(2).toString()
          );
          let erc721Index = await blueprint.latestErc721TokenIndex();
          expect(erc721Index.toString()).to.be.equal(
            BigNumber.from(oneThousandPieces).toString()
          );
        });
      });
      describe("2: should allow for pausing of sale", function () {
        it("BlueprintV12", async function() {
          await blueprint.connect(ContractOwner).pauseSale(0);
          let result = await blueprint.blueprints(0);
          expect(result.saleState.toString()).to.be.equal(sale_paused);
          await expect(
            blueprint.connect(ContractOwner).pauseSale(0)
          ).to.be.revertedWith("!ongoing");
        });
        it("CreatorBlueprint", async function() {
          await creatorBlueprint.connect(ContractOwner).pauseSale();
          let result = await creatorBlueprint.blueprint();
          expect(result.saleState.toString()).to.be.equal(sale_paused);
          await expect(
            creatorBlueprint.connect(ContractOwner).pauseSale()
          ).to.be.revertedWith("!ongoing");
        });
      });
      describe("3: should allow for unpausing of paused sale", async function () {
        it("BlueprintV12", async function() {
          await blueprint.connect(ContractOwner).pauseSale(0);
          await blueprint.connect(ContractOwner).unpauseSale(0);
          let result = await blueprint.blueprints(0);
          expect(result.saleState.toString()).to.be.equal(sale_started);
          await expect(
            blueprint.connect(ContractOwner).unpauseSale(0)
          ).to.be.revertedWith("!paused");
        });
        it("CreatorBlueprint", async function() {
          await creatorBlueprint.connect(ContractOwner).pauseSale();
          await creatorBlueprint.connect(ContractOwner).unpauseSale();
          let result = await creatorBlueprint.blueprint();
          expect(result.saleState.toString()).to.be.equal(sale_started);
          await expect(
            creatorBlueprint.connect(ContractOwner).unpauseSale()
          ).to.be.revertedWith("!paused");
        });
      });
      describe("5: should allow users to purchase blueprints", function () {
        it("BlueprintV12", async function () {
          let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
          await blueprint
            .connect(user2)
            .purchaseBlueprints(0, tenPieces, tenPieces, 0, [], { value: blueprintValue });
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
        })
        it("CreatorBlueprints", async function() {
          let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
          await creatorBlueprint
            .connect(user2)
            .purchaseBlueprints(tenPieces, tenPieces, 0, [], { value: blueprintValue });
          let result = await creatorBlueprint.blueprint();
          let expectedCap = oneThousandPieces - tenPieces;
          expect(result.capacity.toString()).to.be.equal(
            BigNumber.from(expectedCap).toString()
          );
          //should end on the next index
          //this user owns 0 - 9, next user will own 10 - x
          expect(result.erc721TokenIndex.toString()).to.be.equal(
            BigNumber.from(tenPieces).toString()
          );
        })
      });
      describe("6: should not allow users to purchase blueprints if sale paused", function () {
        it("BlueprintV12", async function () {
          await blueprint.connect(ContractOwner).pauseSale(0);
          let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
          await expect(
            blueprint
              .connect(user2)
              .purchaseBlueprints(0, tenPieces, tenPieces, 0, [], { value: blueprintValue })
          ).to.be.revertedWith("unavailable");
        })
        it("CreatorBlueprint", async function () {
          await creatorBlueprint.connect(ContractOwner).pauseSale();
          let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
          await expect(
            creatorBlueprint
              .connect(user2)
              .purchaseBlueprints(tenPieces, tenPieces, 0, [], { value: blueprintValue })
          ).to.be.revertedWith("unavailable");
        })
      });
      describe("Sale + purchase interactions", function () {
        describe("1: should distribute fees", function () {
          it("BlueprintV12", async function () {
            let ownerBal = await ContractOwner.getBalance();
            let artistBal = await testArtist.getBalance();
            let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
            await blueprint
              .connect(user2)
              .purchaseBlueprints(0, tenPieces, tenPieces, 0, [], { value: blueprintValue });
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
          it("CreatorBlueprints", async function () {
            let ownerBal = await ContractOwner.getBalance();
            let artistBal = await testArtist.getBalance();
            let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
            await creatorBlueprint
              .connect(user2)
              .purchaseBlueprints(tenPieces, tenPieces, 0, [], { value: blueprintValue });
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
          })
        });
        describe("2: should not allow user to specify an Erc20 amount", function () {
          it("BlueprintV12", async function () {
            let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
            await expect(
              blueprint
                .connect(user2)
                .purchaseBlueprints(0, tenPieces, tenPieces, 10, [], { value: blueprintValue })
            ).to.be.revertedWith("tokenAmount != 0");
          });
          it("CreatorBlueprints", async function () {
            let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
            await expect(
              creatorBlueprint
                .connect(user2)
                .purchaseBlueprints(tenPieces, tenPieces, 10, [], { value: blueprintValue })
            ).to.be.revertedWith("tokenAmount != 0");
          });
        });
        describe("3: should not allow purchase of more than capacity", function () {
          let fiveHundredPieces = BigNumber.from(oneThousandPieces).div(2);
          let fiveHundredEth = fiveHundredPieces.mul(oneEth);
          it("BlueprintV12", async function () {
            await blueprint
              .connect(user1)
              .purchaseBlueprints(0, fiveHundredPieces, fiveHundredPieces, 0, [], {
                value: fiveHundredEth,
              });
  
            await expect(
              blueprint
                .connect(user2)
                .purchaseBlueprints(
                  0,
                  fiveHundredPieces.add(BigNumber.from(1)),
                  fiveHundredPieces.add(BigNumber.from(1)),
                  0,
                  [],
                  { value: fiveHundredEth.add(oneEth) }
                )
            ).to.be.revertedWith("quantity >");
          });
          it("CreatorBlueprint", async function () {
            await creatorBlueprint
              .connect(user1)
              .purchaseBlueprints(fiveHundredPieces, fiveHundredPieces, 0, [], {
                value: fiveHundredEth,
              });
  
            await expect(
              creatorBlueprint
                .connect(user2)
                .purchaseBlueprints(
                  fiveHundredPieces.add(BigNumber.from(1)),
                  fiveHundredPieces.add(BigNumber.from(1)),
                  0,
                  [],
                  { value: fiveHundredEth.add(oneEth) }
                )
            ).to.be.revertedWith("quantity >");
          })
        });
        describe("6: should allow display token URI", function () {
          it("BlueprintV12", async function () {
            let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
            await blueprint
              .connect(user2)
              .purchaseBlueprints(0, tenPieces, tenPieces, 0, [], { value: blueprintValue });
    
            await blueprint
              .connect(ContractOwner)
              .updateBlueprintTokenUri(0, "https://test.baseUri");
            let tokenUri = await blueprint.tokenURI(1);
    
            await expect(tokenUri).to.be.equal("https://test.baseUri/1/token.json");
          });
          it("CreatorBlueprint", async function () {
            let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
            await creatorBlueprint
              .connect(user2)
              .purchaseBlueprints(tenPieces, tenPieces, 0, [], { value: blueprintValue });
    
            await creatorBlueprint
              .connect(ContractOwner)
              .updateBlueprintTokenUri("https://test.baseUri");

            let tokenUri = await creatorBlueprint.tokenURI(1);
    
            await expect(tokenUri).to.be.equal("https://test.baseUri/1/token.json");
          })
        });
      });
    })
    describe("without sale started", function() {
      describe("4: should not allow pausing of unstarted sale", function () {
        it("BlueprintV12", async function() {
          await expect(
            blueprint.connect(ContractOwner).pauseSale(0)
          ).to.be.revertedWith("!ongoing");
        })
        it("CreatorBlueprints", async function () {
          await expect(
            creatorBlueprint.connect(ContractOwner).pauseSale()
          ).to.be.revertedWith("!ongoing");
        })
      });
    })
  });
  describe("should default fees if none provided", function () {
    let Blueprint;
    let SplitMain;
    let splitMain;
    let blueprint;
    let creatorBlueprint;
    let CreatorBlueprint;
    let creatorFeeAllocationBPS = 500;
    beforeEach(async function() {
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

      // initialize the per creator blueprint contract
      CreatorBlueprint = await ethers.getContractFactory("CreatorBlueprints");
      creatorBlueprint = await CreatorBlueprint.deploy(); 

      // initialize the per creator blueprint contract
      creatorBlueprint.initialize(["Steve's Blueprint", "ABP", "https://async.art/steve-metadata", testArtist.address], [ContractOwner.address, ContractOwner.address, ContractOwner.address], [splitMain.address, creatorFeeAllocationBPS], testPlatform.address);
      
      // prepare a blueprint on the creator contract
      await creatorBlueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          [
            oneThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            0
          ],
          [[],[]]
        );

      // initialize the global blueprints contract
      blueprint.initialize("Async Blueprint", "ABP", [ContractOwner.address, ContractOwner.address, ContractOwner.address], splitMain.address);
      
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          [
            oneThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            0
          ],
          emptyFeesInput
        );
    })
    it("BlueprintV12", async function() {
      await blueprint.connect(ContractOwner).beginSale(0);
      await blueprint.setAsyncFeeRecipient(testPlatform.address);
      let testPlatformBal = await testPlatform.getBalance();
      let artistBal = await testArtist.getBalance();
      let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
      await blueprint
        .connect(user2)
        .purchaseBlueprints(0, tenPieces, tenPieces, 0, [], { value: blueprintValue });
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
    })
    it("CreatorBlueprint", async function() {
      await creatorBlueprint.connect(ContractOwner).beginSale();
      await creatorBlueprint.setAsyncFeeRecipient(testPlatform.address);
      let testPlatformBal = await testPlatform.getBalance();
      let artistBal = await testArtist.getBalance();
      let blueprintValue = BigNumber.from(tenPieces).mul(oneEth);
      await creatorBlueprint
        .connect(user2)
        .purchaseBlueprints(tenPieces, tenPieces, 0, [], { value: blueprintValue });
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
    })
  });
  describe("C: Expired timestamp sales tests", function () {
    let Blueprint;
    let SplitMain;
    let splitMain;
    let blueprint;
    let creatorBlueprint;
    let CreatorBlueprint;
    let creatorFeeAllocationBPS = 500;

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

      // initialize the per creator blueprint contract
      CreatorBlueprint = await ethers.getContractFactory("CreatorBlueprints");
      creatorBlueprint = await CreatorBlueprint.deploy(); 

      // initialize the per creator blueprint contract
      creatorBlueprint.initialize(["Steve's Blueprint", "ABP", "https://async.art/steve-metadata", testArtist.address], [ContractOwner.address, ContractOwner.address, ContractOwner.address], [splitMain.address, creatorFeeAllocationBPS], testPlatform.address);
      
      let latestBlock = await ethers.provider.getBlockNumber();
      let latestBlocktimestamp = (await ethers.provider.getBlock(latestBlock)).timestamp
      let nextBlockTimestamp = latestBlocktimestamp + 15
      await ethers.provider.send("evm_mine", [nextBlockTimestamp]);
      // prepare a blueprint on the creator contract
      await creatorBlueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          [
            oneThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            BigNumber.from(nextBlockTimestamp).add(10000)
          ],
          [[1000, 9000], [ContractOwner.address, testArtist.address]]
        );
      await creatorBlueprint.connect(ContractOwner).beginSale();

      blueprint.initialize("Async Blueprint", "ABP", [ContractOwner.address, ContractOwner.address, ContractOwner.address], splitMain.address);
      latestBlock = await ethers.provider.getBlockNumber();
      latestBlocktimestamp = (await ethers.provider.getBlock(latestBlock)).timestamp
      nextBlockTimestamp = latestBlocktimestamp + 15
      await ethers.provider.send("evm_mine", [nextBlockTimestamp]);
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          testArtist.address,
          [
            oneThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.merkleTree.getHexRoot(),
            0,
            0,
            0,
            BigNumber.from(nextBlockTimestamp).add(10)
          ],
          feesInput
        );
      await blueprint.connect(ContractOwner).beginSale(0);
    });
    describe("1. Can't unpause a sale with an expired timestamp", function () {
      it("BlueprintV12", async function() {
        await blueprint.connect(ContractOwner).pauseSale(0);
        let result = await blueprint.blueprints(0);
        expect(result.saleState.toString()).to.be.equal(sale_paused);
        // Simulate a time delay by setting the timestamp of the next block far in the future
        const latestBlock = await ethers.provider.getBlockNumber();
        const latestBlocktimestamp = (await ethers.provider.getBlock(latestBlock)).timestamp
        const nextBlockTimestamp = latestBlocktimestamp + 1000
        await ethers.provider.send("evm_mine", [nextBlockTimestamp]);
        // Sale un-pausing should fail because the on-chain time has past the saleEndTimestamp
        await expect(
          blueprint.connect(ContractOwner).unpauseSale(0)
        ).to.be.revertedWith("ended");
      })
      it("CreatorBlueprint", async function () {
        await creatorBlueprint.connect(ContractOwner).pauseSale();
        let result = await creatorBlueprint.blueprint();
        expect(result.saleState.toString()).to.be.equal(sale_paused);
        // Simulate a time delay by setting the timestamp of the next block far in the future
        const latestBlock = await ethers.provider.getBlockNumber();
        const latestBlocktimestamp = (await ethers.provider.getBlock(latestBlock)).timestamp
        const nextBlockTimestamp = latestBlocktimestamp + 100000
        await ethers.provider.send("evm_mine", [nextBlockTimestamp]);
        // Sale un-pausing should fail because the on-chain time has past the saleEndTimestamp
        await expect(
          creatorBlueprint.connect(ContractOwner).unpauseSale()
        ).to.be.revertedWith("ended");
      })
    });
    describe("2. Can't purchase blueprints from a sale with an expired timestamp", function () {
      it("BlueprintV12", async function () {
        // Simulate a time delay by setting the timestamp of the next block far in the future
        const latestBlock = await ethers.provider.getBlockNumber();
        const latestBlocktimestamp = (await ethers.provider.getBlock(latestBlock)).timestamp
        const nextBlockTimestamp = latestBlocktimestamp + 1000
        await ethers.provider.send("evm_mine", [nextBlockTimestamp]);
        await expect (
          blueprint
            .connect(user2)
            .purchaseBlueprints(0, tenPieces, tenPieces, 0, [], { value: BigNumber.from(tenPieces).mul(oneEth) })
        ).to.be.revertedWith("unavailable");
      })
      it("CreatorBlueprint", async function () {
        const latestBlock = await ethers.provider.getBlockNumber();
        const latestBlocktimestamp = (await ethers.provider.getBlock(latestBlock)).timestamp
        const nextBlockTimestamp = latestBlocktimestamp + 100000
        await ethers.provider.send("evm_mine", [nextBlockTimestamp]);
        await expect (
          creatorBlueprint
            .connect(user2)
            .purchaseBlueprints(tenPieces, tenPieces, 0, [], { value: BigNumber.from(tenPieces).mul(oneEth) })
        ).to.be.revertedWith("unavailable");
      })
    });
  });
});