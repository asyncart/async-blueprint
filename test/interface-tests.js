const { expect } = require("chai");
const { intToBuffer } = require("ethjs-util");

describe.skip("Admin Blueprint Tests", function () {
  let Blueprint;
  let SplitMain;
  let splitMain; 
  let blueprint;
  let CreatorBlueprint;
  let creatorBlueprint;

  beforeEach(async function () {
    [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
      await ethers.getSigners();

    // deploy global blueprint splitter
    Blueprint = await ethers.getContractFactory("BlueprintV12");
    blueprint = await Blueprint.deploy();

    // deploy splitter
    SplitMain = await ethers.getContractFactory("SplitMain");
    splitMain = await SplitMain.deploy();

    // initialize the per creator blueprint contract
    CreatorBlueprint = await ethers.getContractFactory("CreatorBlueprints");
    creatorBlueprint = await CreatorBlueprint.deploy(); 

    // initialize the per creator blueprint contract
    creatorBlueprint.initialize(["Steve's Blueprint", "ABP", "https://async.art/steve-metadata", testArtist.address], [ContractOwner.address, ContractOwner.address, ContractOwner.address], [splitMain.address, 5000], testPlatform.address);
    
    // initialize global blueprint contract
    blueprint.initialize("Async Blueprint", "ABP", [ContractOwner.address, ContractOwner.address, ContractOwner.address], splitMain.address);
  });
  describe("supports HasSecondarySaleFees interface", function () {
    // This interfaceId is different than the _INTERFACE_ID_FEES that HasSecondarySaleFees registers with ERC165 but it matches its type(HasSecondarySaleFees).interfaceId which is what we really care about
    it("BlueprintsV12", async function() {
      let supports = await blueprint.connect(ContractOwner).supportsInterface(0x37d7db38);
      expect(supports).to.be.equal(true);
    });
    it("CreatorBlueprints", async function() {
      let supports = await creatorBlueprint.connect(ContractOwner).supportsInterface(0x37d7db38);
      expect(supports).to.be.equal(true);
    });
  });
});