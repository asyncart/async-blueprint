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

  describe("Mint all elements", function () {
    let Blueprint;
    let blueprint;
    let feeRecipients;
    let feeBps;
    before(async function () {
      [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
        await ethers.getSigners();

      feeRecipients = [ContractOwner.address, testArtist.address];
      feeBps = [1000, 9000];
      Blueprint = await ethers.getContractFactory("Blueprint");
      blueprint = await Blueprint.deploy();
      blueprint.initialize("Async Blueprint", "ABP");
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
          this.merkleTree.getHexRoot()
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
        /**
         * Create merkle proof (anyone with knowledge of the merkle tree)
         */

        /**
         * Redeems token using merkle proof (anyone with the proof)
         */
      });
    }
    it("should not allow non whitelisted user", async function () {
      const proof = this.merkleTree.getHexProof(hashToken(user3.address, 1));
      await expect(
        blueprint
          .connect(user3)
          .purchaseBlueprints(0, 1, 0, proof, { value: oneEth })
      ).to.be.revertedWith("not available to purchase");
    });
  });
});
