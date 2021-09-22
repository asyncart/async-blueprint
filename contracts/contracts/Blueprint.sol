//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "./abstract/HasSecondarySaleFees.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "hardhat/console.sol";

contract Blueprint is
    ERC721Upgradeable,
    HasSecondarySaleFees,
    AccessControlEnumerableUpgradeable
{
    uint32 public defaultBlueprintSecondarySalePercentage;
    uint32 public defaultPlatformSecondarySalePercentage;
    uint256 public latestErc721TokenIndex;

    address public asyncSaleFeesRecipient;
    mapping(uint256 => Blueprints) public blueprints;
    mapping(address => uint256) failedTransferCredits;

    uint256 public blueprintIndex;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum SaleState {
        not_prepared,
        not_started,
        started,
        paused
    }
    struct Blueprints {
        SaleState saleState;
        //0 for not started, 1 for started, 2 for paused
        uint256 capacity;
        uint256 price;
        uint256 erc721TokenIndex;
        address ERC20Token;
        address artist;
        string randomSeedSigHash;
        string baseTokenUri;
        address[] feeRecipients;
        uint32[] feeBPS;
        bytes32 merkleroot;
    }

    event BlueprintSeed(uint256 blueprintID, string randomSeed);

    event BlueprintPurchased(
        uint256 blueprintID,
        address artist,
        address purchaser,
        uint256 quantity,
        bytes32 seedPrefix
    );

    modifier isBlueprintPrepared(uint256 _blueprintID) {
        require(
            blueprints[_blueprintID].saleState != SaleState.not_prepared,
            "blueprint not prepared"
        );
        _;
    }

    modifier hasSaleStarted(uint256 _blueprintID) {
        require(_hasSaleStarted(_blueprintID), "Sale not started");
        _;
    }

    modifier BuyerWhitelistedOrSaleStarted(
        uint256 _blueprintID,
        uint256 _quantity,
        bytes32[] calldata proof
    ) {
        require(
            _hasSaleStarted(_blueprintID) ||
                userWhitelisted(_blueprintID, _quantity, proof),
            "not available to purchase"
        );
        _;
    }

    function _hasSaleStarted(uint256 _blueprintID)
        internal
        view
        returns (bool)
    {
        return blueprints[_blueprintID].saleState == SaleState.started;
    }

    function _getFeePortion(uint256 _totalSaleAmount, uint256 _percentage)
        internal
        pure
        returns (uint256)
    {
        return (_totalSaleAmount * (_percentage)) / 10000;
    }

    function userWhitelisted(
        uint256 _blueprintID,
        uint256 _quantity,
        bytes32[] calldata proof
    ) internal view returns (bool) {
        bytes32 _merkleroot = blueprints[_blueprintID].merkleroot;
        return _verify(_leaf(msg.sender, _quantity), _merkleroot, proof);
    }

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
        //TODO Should tokenID start at 0 or 1?
        // latestErc721TokenIndex = 1;

        asyncSaleFeesRecipient = msg.sender;
    }

    function prepareBlueprint(
        address _artist,
        uint256 _capacity,
        uint256 _price,
        address _erc20Token,
        string memory _randomSeedSigHash,
        string memory _baseTokenUri,
        address[] memory _feeRecipients,
        uint32[] memory _feeBps,
        bytes32 _merkleroot
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 _blueprintID = blueprintIndex;
        blueprints[_blueprintID].artist = _artist;
        blueprints[_blueprintID].capacity = _capacity;
        blueprints[_blueprintID].price = _price;
        if (_erc20Token != address(0)) {
            blueprints[_blueprintID].ERC20Token = _erc20Token;
        }
        blueprints[_blueprintID].randomSeedSigHash = _randomSeedSigHash;
        blueprints[_blueprintID].baseTokenUri = _baseTokenUri;
        if (_feeRecipients.length != 0 || _feeBps.length != 0) {
            require(
                _feeRecipients.length == _feeBps.length,
                "mismatched recipients & Bps"
            );
            uint32 totalPercent;
            for (uint256 i = 0; i < _feeBps.length; i++) {
                totalPercent = totalPercent + _feeBps[i];
            }
            require(totalPercent <= 10000, "Fee Bps exceed maximum");
            blueprints[_blueprintID].feeRecipients = _feeRecipients;
            blueprints[_blueprintID].feeBPS = _feeBps;
        }
        if (_merkleroot != 0) {
            blueprints[_blueprintID].merkleroot = _merkleroot;
        }

        blueprints[_blueprintID].saleState = SaleState.not_started;
        blueprintIndex++;
    }

    function beginSale(uint256 blueprintID)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            blueprints[blueprintID].saleState == SaleState.not_started,
            "sale started or not prepared"
        );
        blueprints[blueprintID].saleState = SaleState.started;
        //assign the erc721 token index to the blueprint
        blueprints[blueprintID].erc721TokenIndex = latestErc721TokenIndex;
        latestErc721TokenIndex += (blueprints[blueprintID].capacity);
    }

    function pauseSale(uint256 blueprintID)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        hasSaleStarted(blueprintID)
    {
        blueprints[blueprintID].saleState = SaleState.paused;
    }

    function unpauseSale(uint256 blueprintID)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            blueprints[blueprintID].saleState == SaleState.paused,
            "Sale not paused"
        );
        blueprints[blueprintID].saleState = SaleState.started;
    }

    function purchaseBlueprints(
        uint256 blueprintID,
        uint256 quantity,
        uint256 tokenAmount,
        bytes32[] calldata proof
    )
        external
        payable
        BuyerWhitelistedOrSaleStarted(blueprintID, quantity, proof)
    {
        require(
            blueprints[blueprintID].capacity >= quantity,
            "quantity exceeds capacity"
        );
        address _erc20Token = blueprints[blueprintID].ERC20Token;
        if (_erc20Token == address(0)) {
            require(tokenAmount == 0, "cannot specify token amount");
            require(
                msg.value == quantity * blueprints[blueprintID].price,
                "Purchase amount must match price"
            );
            _payFeesAndArtist(blueprintID, msg.value);
        } else {
            require(msg.value == 0, "cannot specify eth amount");
            require(
                tokenAmount == quantity * blueprints[blueprintID].price,
                "Purchase amount must match price"
            );

            IERC20(_erc20Token).transferFrom(
                msg.sender,
                address(this),
                tokenAmount
            );
            _payFeesAndArtist(blueprintID, tokenAmount);
        }
        blueprints[blueprintID].capacity -= quantity;
        _mintQuantity(blueprintID, quantity);

        bytes32 prefixHash = keccak256(
            abi.encodePacked(
                block.number,
                block.timestamp,
                block.coinbase,
                blueprints[blueprintID].capacity
            )
        );

        emit BlueprintPurchased(
            blueprintID,
            blueprints[blueprintID].artist,
            msg.sender,
            quantity,
            prefixHash
        );
    }

    /*
     * Iterate and mint each blueprint for user
     */
    function _mintQuantity(uint256 _blueprintID, uint256 _quantity) private {
        for (uint256 i = 0; i < _quantity; i++) {
            uint256 newTokenId = blueprints[_blueprintID].erc721TokenIndex;
            _mint(msg.sender, newTokenId);
            blueprints[_blueprintID].erc721TokenIndex += 1;
        }
    }

    ////////////////////////////////////
    ////// MERKLEROOT FUNCTIONS ////////
    ////////////////////////////////////

    function _leaf(address account, uint256 quantity)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(account, quantity));
    }

    function _verify(
        bytes32 leaf,
        bytes32 merkleroot,
        bytes32[] memory proof
    ) internal pure returns (bool) {
        return MerkleProof.verify(proof, merkleroot, leaf);
    }

    ////////////////////////////
    /// ONLY ADMIN functions ///
    ////////////////////////////

    function updateBaseTokenUri(
        uint256 blueprintID,
        string memory newBaseTokenUri
    ) external onlyRole(DEFAULT_ADMIN_ROLE) isBlueprintPrepared(blueprintID) {
        blueprints[blueprintID].baseTokenUri = newBaseTokenUri;
    }

    function revealBlueprintSeed(uint256 blueprintID, string memory randomSeed)
        external
    {
        emit BlueprintSeed(blueprintID, randomSeed);
    }

    function setAsyncFeeRecipient(address _asyncSaleFeesRecipient)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        asyncSaleFeesRecipient = _asyncSaleFeesRecipient;
    }

    function changedefaultBlueprintSecondarySalePercentage(uint32 _basisPoints)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_basisPoints + defaultPlatformSecondarySalePercentage <= 10000);
        defaultBlueprintSecondarySalePercentage = _basisPoints;
    }

    function changeDefaultPlatformSecondarySalePercentage(uint32 _basisPoints)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            _basisPoints + defaultBlueprintSecondarySalePercentage <= 10000
        );
        defaultPlatformSecondarySalePercentage = _basisPoints;
    }

    function updatePlatformAddress(address platform)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(DEFAULT_ADMIN_ROLE, platform);
        revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    ////////////////////////////////////
    /// Secondary Fees implementation //
    ////////////////////////////////////

    function _payFeesAndArtist(uint256 _blueprintID, uint256 _amount) internal {
        address[] memory _feeRecipients = getFeeRecipients(_blueprintID);
        uint32[] memory _feeBPS = getFeeBps(_blueprintID);
        for (uint256 i = 0; i < _feeRecipients.length; i++) {
            uint256 fee = _getFeePortion(_amount, _feeBPS[i]);
            _payout(_blueprintID, _feeRecipients[i], fee);
        }
    }

    function _payout(
        uint256 _blueprintID,
        address _recipient,
        uint256 _amount
    ) internal {
        address ERC20Token = blueprints[_blueprintID].ERC20Token;
        if (ERC20Token != address(0)) {
            IERC20(ERC20Token).transfer(_recipient, _amount);
        } else {
            // attempt to send the funds to the recipient
            (bool success, ) = payable(_recipient).call{
                value: _amount,
                gas: 20000
            }("");
            // if it failed, update their credit balance so they can pull it later
            if (!success) {
                failedTransferCredits[_recipient] =
                    failedTransferCredits[_recipient] +
                    _amount;
            }
        }
    }

    function withdrawAllFailedCredits() external {
        uint256 amount = failedTransferCredits[msg.sender];

        require(amount != 0, "no credits to withdraw");

        failedTransferCredits[msg.sender] = 0;

        (bool successfulWithdraw, ) = msg.sender.call{
            value: amount,
            gas: 20000
        }("");
        require(successfulWithdraw, "withdraw failed");
    }

    function getFeeRecipients(uint256 id)
        public
        view
        override
        returns (address[] memory)
    {
        if (blueprints[id].feeRecipients.length == 0) {
            address[] memory feeRecipients = new address[](2);
            feeRecipients[0] = (asyncSaleFeesRecipient);
            feeRecipients[1] = (blueprints[id].artist);

            return feeRecipients;
        } else {
            return blueprints[id].feeRecipients;
        }
    }

    function getFeeBps(uint256 id)
        public
        view
        override
        returns (uint32[] memory)
    {
        if (blueprints[id].feeBPS.length == 0) {
            uint32[] memory feeBPS = new uint32[](2);
            feeBPS[0] = defaultPlatformSecondarySalePercentage;
            feeBPS[1] = defaultBlueprintSecondarySalePercentage;

            return feeBPS;
        } else {
            return blueprints[id].feeBPS;
        }
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