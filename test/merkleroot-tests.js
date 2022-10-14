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
  primaryFeeRecipients: [],
  secondaryFeesInput: {
    secondaryFeeRecipients: [],
    secondaryFeeMPS: [],
    totalRoyaltyCutBPS: 0,
    royaltyRecipient: zeroAddress
  },
  deploySplit: false
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

function computeMerkleFromMapping(mapping) {
  return new MerkleTree(
    Object.entries(mapping).map((mapping) => hashToken(...mapping)),
    keccak256,
    { sortPairs: true }
  );
}

describe("Merkleroot Tests", function () {

  // whitelist mapping
  let mapping = {
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "10",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "2"
  }

  let mappingCreator = {
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "10",
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "2"
  }

  before(async function () {
    this.accounts = await ethers.getSigners();
    this.merkleTree = new MerkleTree(
      Object.entries(mapping).map((mapping) => hashToken(...mapping)),
      keccak256,
      { sortPairs: true }
    );
    this.creatorMerkleTree = new MerkleTree(
      Object.entries(mappingCreator).map((mappingCreator) => hashToken(...mappingCreator)),
      keccak256,
      { sortPairs: true }
    );
  });

  describe("Without merkle root provided", function () {
    let Blueprint;
    let SplitMain;
    let splitMain; 
    let blueprint;
    let creatorBlueprint;
    let CreatorBlueprint;

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
    
    before(async function () {
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
            tenThousandPieces,
            oneEth.div(2),
            zeroAddress,
            testHash,
            testUri,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            0,
            0,
            0,
            0
          ],
          [[],[]]
        );

      blueprint.initialize("Async Blueprint", "ABP", [ContractOwner.address, ContractOwner.address, ContractOwner.address], splitMain.address);
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          user3.address,
          [
            tenThousandPieces,
            oneEth.div(2),
            zeroAddress,
            testHash,
            testUri,
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            0,
            0,
            0,
            0
          ],
          emptyFeeRecipients
        );
    });
    it("BlueprintV12", async function() {
      const proof = this.merkleTree.getHexProof(hashToken(user1.address, 10));
      const blueprintValue = BigNumber.from(1).mul(oneEth).div(2);
      await expect(
        blueprint
          .connect(user1)
          .purchaseBlueprints(1, 1, 1, 0, proof, { value: blueprintValue })
      ).to.be.revertedWith("e");
    })
    it("CreatorBlueprint", async function() {
      const proof = this.merkleTree.getHexProof(hashToken(user1.address, 10));
      const blueprintValue = BigNumber.from(1).mul(oneEth).div(2);
      await expect(
        creatorBlueprint
          .connect(user1)
          .purchaseBlueprints(1, 1, 0, proof, { value: blueprintValue })
      ).to.be.revertedWith("e");
    })
  });

  describe("with merkleroot defined", function () {
    let Blueprint;
    let SplitMain;
    let splitMain; 
    let blueprint;
    let creatorBlueprint;
    let CreatorBlueprint;

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
    
    before(async function () {
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
            tenThousandPieces,
            oneEth,
            zeroAddress,
            testHash,
            testUri,
            this.creatorMerkleTree.getHexRoot(),
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
            tenThousandPieces,
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
    describe("1: should not allow non whitelisted user", function () {
      it("BlueprintV12", async function() {
        const proof = this.merkleTree.getHexProof(hashToken(user2.address, 2));
        await expect(
          blueprint
            .connect(user3)
            .purchaseBlueprints(0, 1, 1, 0, proof, { value: oneEth })
        ).to.be.revertedWith("e");
      })
      it("CreatorBlueprint", async function() {
        const proof = this.merkleTree.getHexProof(hashToken(user2.address, 2));
        await expect(
          creatorBlueprint
            .connect(user3)
            .purchaseBlueprints(1, 1, 0, proof, { value: oneEth })
        ).to.be.revertedWith("e");
      })
    });
    describe("3: should revert when no proof provided", function () {
      it("BlueprintV12", async function () {
        const proof = this.merkleTree.getHexProof(hashToken(user1.address, 1));
        await expect(
          blueprint
            .connect(user3)
            .purchaseBlueprints(0, 1, 1, 0, proof, { value: oneEth })
        ).to.be.revertedWith("e");
      });
      it("CreatorBlueprint", async function () {
        const proof = this.merkleTree.getHexProof(hashToken(user1.address, 1));
        await expect(
          creatorBlueprint
            .connect(user3)
            .purchaseBlueprints(1, 1, 0, proof, { value: oneEth })
        ).to.be.revertedWith("e");
      })
    });

    let capacity = tenThousandPieces;
    let index = BigNumber.from(0);
    let creatorCapacity = tenThousandPieces;
    let creatorIndex = BigNumber.from(0);
    for (const [account, quantity] of Object.entries(mapping)) {
      it("CreatorBlueprint", async function () {
        let buyer;
        if (user1.address == account) {
          buyer = user1;
        } else {
          buyer = user2;
        }

        // purchase half of whitelisted amount
        let quantityToPurchase = (parseInt(quantity)/2).toString()
        let proof = this.creatorMerkleTree.getHexProof(hashToken(account, quantity));
        const blueprintValue = BigNumber.from(quantityToPurchase).mul(oneEth);

        await creatorBlueprint
          .connect(buyer)
          .purchaseBlueprints(quantityToPurchase, quantity, 0, proof, { value: blueprintValue });

        // assert on state changes of first purchase
        let result = await creatorBlueprint.blueprint();
        creatorCapacity = creatorCapacity - quantityToPurchase;
        expect(result.capacity.toString()).to.be.equal(
          BigNumber.from(creatorCapacity).toString()
        );
        mappingCreator[account] = (parseInt(quantity) - parseInt(quantityToPurchase)).toString()
        this.creatorMerkleTree = computeMerkleFromMapping(mappingCreator)
        expect(result.merkleroot).to.be.equal(this.creatorMerkleTree.getHexRoot());
        //should end on the next index
        //this user owns 0 - 9, next user will own 10 - x
        creatorIndex = creatorIndex.add(BigNumber.from(quantityToPurchase));
        expect(result.erc721TokenIndex.toString()).to.be.equal(
          BigNumber.from(creatorIndex).toString()
        );

        // purchase second half of whitelisted amount
        proof = this.creatorMerkleTree.getHexProof(hashToken(account, quantityToPurchase));
        await creatorBlueprint
          .connect(buyer)
          .purchaseBlueprints(quantityToPurchase, quantityToPurchase, 0, proof, { value: blueprintValue });

        // assert on state changes of second purchase
        result = await creatorBlueprint.blueprint();
        creatorCapacity = creatorCapacity - quantityToPurchase;
        expect(result.capacity.toString()).to.be.equal(
          BigNumber.from(creatorCapacity).toString()
        );
        mappingCreator[account] = "0"
        this.creatorMerkleTree = computeMerkleFromMapping(mappingCreator)
        expect(result.merkleroot).to.be.equal(this.creatorMerkleTree.getHexRoot());
        //should end on the next index
        //this user owns 0 - 9, next user will own 10 - x
        creatorIndex = creatorIndex.add(BigNumber.from(quantityToPurchase));
        expect(result.erc721TokenIndex.toString()).to.be.equal(
          BigNumber.from(creatorIndex).toString()
        );

        // Assert that we cannot buy anymore, not the best assertion,
        proof = this.creatorMerkleTree.getHexProof(hashToken(account, "0"));
        await expect(
          creatorBlueprint.connect(buyer).purchaseBlueprints(1, 1, 0, proof, {
            value: blueprintValue,
          })
        ).to.be.revertedWith("e");
      });
      it("BlueprintV12", async function () {
        let buyer;
        if (user1.address == account) {
          buyer = user1;
        } else {
          buyer = user2;
        }

        // purchase half of whitelisted amount
        let quantityToPurchase = (parseInt(quantity)/2).toString()
        let proof = this.merkleTree.getHexProof(hashToken(account, quantity));
        const blueprintValue = BigNumber.from(quantityToPurchase).mul(oneEth);

        await blueprint
          .connect(buyer)
          .purchaseBlueprints(0, quantityToPurchase, quantity, 0, proof, { value: blueprintValue });

        // assert on state changes of first purchase
        let result = await blueprint.blueprints(0);
        capacity = capacity - quantityToPurchase;
        expect(result.capacity.toString()).to.be.equal(
          BigNumber.from(capacity).toString()
        );
        mapping[account] = (parseInt(quantity) - parseInt(quantityToPurchase)).toString()
        this.merkleTree = computeMerkleFromMapping(mapping)
        expect(result.merkleroot).to.be.equal(this.merkleTree.getHexRoot());
        //should end on the next index
        //this user owns 0 - 9, next user will own 10 - x
        index = index.add(BigNumber.from(quantityToPurchase));
        expect(result.erc721TokenIndex.toString()).to.be.equal(
          BigNumber.from(index).toString()
        );

        // purchase second half of whitelisted amount
        proof = this.merkleTree.getHexProof(hashToken(account, quantityToPurchase));
        await blueprint
          .connect(buyer)
          .purchaseBlueprints(0, quantityToPurchase, quantityToPurchase, 0, proof, { value: blueprintValue });

        // assert on state changes of second purchase
        result = await blueprint.blueprints(0);
        capacity = capacity - quantityToPurchase;
        expect(result.capacity.toString()).to.be.equal(
          BigNumber.from(capacity).toString()
        );
        mapping[account] = "0"
        this.merkleTree = computeMerkleFromMapping(mapping)
        expect(result.merkleroot).to.be.equal(this.merkleTree.getHexRoot());
        //should end on the next index
        //this user owns 0 - 9, next user will own 10 - x
        index = index.add(BigNumber.from(quantityToPurchase));
        expect(result.erc721TokenIndex.toString()).to.be.equal(
          BigNumber.from(index).toString()
        );

        // Assert that we cannot buy anymore, not the best assertion,
        proof = this.merkleTree.getHexProof(hashToken(account, "0"));
        await expect(
          blueprint.connect(buyer).purchaseBlueprints(0, 1, 1, 0, proof, {
            value: blueprintValue,
          })
        ).to.be.revertedWith("e");
      });
    }
  });
});
