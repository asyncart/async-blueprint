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

describe("Merkleroot Tests", function () {
  before(async function () {
    console.log("A");
    this.accounts = await ethers.getSigners();
    this.merkleTree = new MerkleTree(
      Object.entries(mapping).map((mapping) => hashToken(...mapping)),
      keccak256,
      { sortPairs: true }
    );
  });

  describe("A: Mint all whitelisted", function () {
    let Blueprint;
    let blueprint;
    let feeRecipients = {
      primaryFeeBPS: [],
      secondaryFeeBPS: [],
      primaryFeeRecipients: [],
      secondaryFeeRecipients: []
    }
    before(async function () {
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
          tenThousandPieces,
          oneEth,
          zeroAddress,
          testHash,
          testUri,
          this.merkleTree.getHexRoot(),
          0,
          0,
          0,
          0,
          feeRecipients
        );
    });
    let capacity = tenThousandPieces;
    let index = BigNumber.from(0);
    for (const [account, quantity] of Object.entries(mapping)) {
      it("element", async function () {
        let buyer;
        if (user1.address == account) {
          buyer = user1;
        } else {
          buyer = user2;
        }
        const proof = this.merkleTree.getHexProof(hashToken(account, quantity));
        const blueprintValue = BigNumber.from(quantity).mul(oneEth);
        await blueprint
          .connect(buyer)
          .purchaseBlueprints(0, quantity, 0, proof, { value: blueprintValue });
        let result = await blueprint.blueprints(0);
        capacity = capacity - quantity;
        expect(result.capacity.toString()).to.be.equal(
          BigNumber.from(capacity).toString()
        );
        //should end on the next index
        //this user owns 0 - 9, next user will own 10 - x
        index = index.add(BigNumber.from(quantity));
        expect(result.erc721TokenIndex.toString()).to.be.equal(
          BigNumber.from(index).toString()
        );
        await expect(
          blueprint.connect(buyer).purchaseBlueprints(0, quantity, 0, proof, {
            value: blueprintValue,
          })
        ).to.be.revertedWith("already claimed");
      });
    }
    it("2: should not allow non whitelisted user", async function () {
      const proof = this.merkleTree.getHexProof(hashToken(user2.address, 1));
      await expect(
        blueprint
          .connect(user3)
          .purchaseBlueprints(0, 1, 0, proof, { value: oneEth })
      ).to.be.revertedWith("not available to purchase");
    });
    it("3: should not allow buyer when no merkle provided", async function () {
      await blueprint
        .connect(ContractOwner)
        .prepareBlueprint(
          user3.address,
          tenThousandPieces,
          oneEth.div(2),
          zeroAddress,
          testHash,
          testUri,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          0,
          0,
          0,
          emptyFeeRecipients
        );
      let result = await blueprint.blueprints(1);
      expect(result.saleState.toString()).to.be.equal(
        BigNumber.from(1).toString()
      );
      expect(result.artist).to.be.equal(user3.address);
      expect(result.price.toString()).to.be.equal(oneEth.div(2).toString());
      expect(result.capacity.toString()).to.be.equal(
        BigNumber.from(tenThousandPieces).toString()
      );
      expect(result.erc721TokenIndex.toString()).to.be.equal(
        tenThousandPieces.toString()
      );
      expect(result.baseTokenUri).to.be.equal(testUri);

      const proof = this.merkleTree.getHexProof(hashToken(user1.address, 10));
      const blueprintValue = BigNumber.from(1).mul(oneEth).div(2);
      await expect(
        blueprint
          .connect(user1)
          .purchaseBlueprints(1, 1, 0, proof, { value: blueprintValue })
      ).to.be.revertedWith("not available to purchase");
    });
    it("4: should revert when no proof provided", async function () {
      const proof = this.merkleTree.getHexProof(hashToken(user1.address, 1));
      await expect(
        blueprint
          .connect(user3)
          .purchaseBlueprints(0, 1, 0, proof, { value: oneEth })
      ).to.be.revertedWith("no proof provided");
    });
  });
});
