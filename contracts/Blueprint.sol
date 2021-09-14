//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "./abstract/HasSecondarySaleFees.sol";

import "hardhat/console.sol";

contract Blueprint is
    ERC721Upgradeable,
    HasSecondarySaleFees,
    AccessControlEnumerableUpgradeable
{
    uint256 public defaultBlueprintSecondarySalePercentage;
    uint256 public defaultPlatformSecondarySalePercentage;

    address public asyncSaleFeesRecipient;
    mapping(uint256 => Blueprint) public blueprints;
    uint256 public blueprintIndex;

    struct Blueprint {
        address artist;
        uint256 capacity;
        uint256 price;
        address ERC20Token;
        string randomSeedSigHash;
        string baseTokenUri;
    }

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    function initialize(string memory name_, string memory symbol_)
        public
        initializer
    {
        // Intialize parent contracts
        ERC721Upgradeable.__ERC721_init(name_, symbol_);
        HasSecondarySaleFees._initialize();
        AccessControlUpgradeable.__AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);

        defaultBlueprintSecondarySalePercentage = 1000; // 10%
        defaultPlatformSecondarySalePercentage = 500; //5%

        asyncSaleFeesRecipient = msg.sender;
    }

    function prepareBlueprint(
        address _artist,
        uint256 _capacity,
        uint256 _price,
        address _erc20Token,
        string memory _randomSeedSigHash,
        string memory _baseTokenUri
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 _blueprintIndex = blueprintIndex;
        blueprints[_blueprintIndex].artist = _artist;
        blueprints[_blueprintIndex].capacity = _capacity;
        blueprints[_blueprintIndex].price = _price;
        if (_erc20Token != address(0)) {
            blueprints[_blueprintIndex].ERC20Token = _erc20Token;
        }
        blueprints[_blueprintIndex].randomSeedSigHash = _randomSeedSigHash;
        blueprints[_blueprintIndex].baseTokenUri = _baseTokenUri;

        //        - platformOnly
        // -feeRecipients
        // -feeBPS
        // -capacity
        // -priceAmount
        // -priceCurrency (ETH or ERC20)
        // -randomSeedSignatureHash
        // -baseTokenURI
        // -whitelistedPresalesMerkleroot
        // @Return blueprintID
    }

    ////////////////////////////////////
    /////////// MAIN FUCNTIONS /////////
    ////////////////////////////////////

    // blueprint 1  for token id 1 - 1000
    // blueprint 2 (picaso) 1001 1101
    //
    // function buyBlueprint(uint256 blueprintID, uint256 amount) external {
    //     _mint(msg.sender, 1001); // etc
    // }

    ////////////////////////////
    /// ONLY ADMIN functions ///
    ////////////////////////////

    function setAsyncFeeRecipient(address _asyncSaleFeesRecipient)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        asyncSaleFeesRecipient = _asyncSaleFeesRecipient;
    }

    function changedefaultBlueprintSecondarySalePercentage(uint256 _basisPoints)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_basisPoints + defaultPlatformSecondarySalePercentage <= 10000);
        defaultBlueprintSecondarySalePercentage = _basisPoints;
    }

    function changeDefaultPlatformSecondarySalePercentage(uint256 _basisPoints)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            _basisPoints + defaultBlueprintSecondarySalePercentage <= 10000
        );
        defaultPlatformSecondarySalePercentage = _basisPoints;
    }

    ////////////////////////////////////
    /// Secondary Fees implementation //
    ////////////////////////////////////

    function getFeeRecipients(uint256 id)
        public
        view
        override
        returns (address payable[] memory)
    {
        address payable[] memory feeRecipients = new address payable[](2);
        feeRecipients[0] = payable(asyncSaleFeesRecipient);
        feeRecipients[1] = payable(blueprints[id].artist);

        return feeRecipients;
    }

    function getFeeBps(uint256 id)
        public
        view
        override
        returns (uint256[] memory)
    {
        uint256[] memory fees = new uint256[](2);
        fees[0] = defaultPlatformSecondarySalePercentage;
        fees[1] = defaultBlueprintSecondarySalePercentage;

        return fees;
    }

    ////////////////////////////////////
    /// Required function overide //////
    ////////////////////////////////////

    function isApprovedForAll(address account, address operator)
        public
        view
        override
        returns (bool)
    {
        return
            super.isApprovedForAll(account, operator) ||
            hasRole(OPERATOR_ROLE, operator);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(
            ERC721Upgradeable,
            ERC165StorageUpgradeable,
            AccessControlEnumerableUpgradeable
        )
        returns (bool)
    {
        return
            ERC721Upgradeable.supportsInterface(interfaceId) ||
            ERC165StorageUpgradeable.supportsInterface(interfaceId) ||
            AccessControlEnumerableUpgradeable.supportsInterface(interfaceId);
    }
}
