const { expect } = require("chai");

describe("Admin Blueprint Tests", function () {
  let Blueprint;
  let SplitMain;
  let splitMain; 
  let blueprint;

  beforeEach(async function () {
    [ContractOwner, user1, user2, user3, testArtist, testPlatform] =
      await ethers.getSigners();

    Blueprint = await ethers.getContractFactory("BlueprintV12");
    blueprint = await Blueprint.deploy();
    SplitMain = await ethers.getContractFactory("SplitMain");
    splitMain = await SplitMain.deploy();
    blueprint.initialize("Async Blueprint", "ABP", ContractOwner.address, ContractOwner.address, splitMain.address);
  });
  it("supports HasSecondarySaleFees interface", async function () {
    // This interfaceId is different than the _INTERFACE_ID_FEES that HasSecondarySaleFees registers with ERC165 but it matches its type(HasSecondarySaleFees).interfaceId which is what we really care about
    let supports = await blueprint.connect(ContractOwner).supportsInterface(0x37d7db38);
    expect(supports).to.be.equal(true);
  });
});