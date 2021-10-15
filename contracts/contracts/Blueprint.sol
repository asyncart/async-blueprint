//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "./abstract/HasSecondarySaleFees.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Blueprint is
    ERC721Upgradeable,
    HasSecondarySaleFees,
    AccessControlEnumerableUpgradeable
{
    uint32 public defaultPlatformPrimaryFeePercentage;
    uint64 public latestErc721TokenIndex;
    uint32 public defaultBlueprintSecondarySalePercentage;
    uint32 public defaultPlatformSecondarySalePercentage;

    address public asyncSaleFeesRecipient;
    mapping(uint256 => Blueprints) public blueprints;
    mapping(address => uint256) failedTransferCredits;

    uint256 public blueprintIndex;

    address platform;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum SaleState {
        not_prepared,
        not_started,
        started,
        paused
    }
    struct Blueprints {
        uint32 mintAmountArtist;
        uint32 mintAmountPlatform;
        uint64 capacity;
        uint128 price;
        uint64 erc721TokenIndex;
        address artist;
        SaleState saleState;
        address ERC20Token;
        string baseTokenUri;
        bytes32 merkleroot;
        mapping(address => bool) claimedWhitelistedPieces;
        address[] primaryFeeRecipients;
        uint32[] primaryFeeBPS;
        address[] secondaryFeeRecipients;
        uint32[] secondaryFeeBPS;
    }

    event BlueprintSeed(uint256 blueprintID, string randomSeed);

    event BlueprintMinted(
        uint256 blueprintID,
        address artist,
        address purchaser,
        uint128 tokenId,
        uint64 newCapacity,
        bytes32 seedPrefix
    );

    event BlueprintPrepared(
        uint256 blueprintID,
        address artist,
        uint64 capacity,
        uint128 price,
        address erc20Token,
        string blueprintMetaData,
        string baseTokenUri,
        address[] primaryFeeRecipients,
        uint32[] primaryFeeBPS,
        bytes32 merkleroot,
        uint32 mintAmountArtist,
        uint32 mintAmountPlatform
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
        uint32 _quantity,
        bytes32[] calldata proof
    ) {
        require(
            _hasSaleStarted(_blueprintID) ||
                (_isBlueprintPreparedAndNotStarted(_blueprintID) &&
                    userWhitelisted(_blueprintID, uint256(_quantity), proof)),
            "not available to purchase"
        );
        _;
    }

    modifier isQuantityAvailableForPurchase(
        uint256 _blueprintID,
        uint32 _quantity
    ) {
        require(
            blueprints[_blueprintID].capacity >= _quantity,
            "quantity exceeds capacity"
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

    function _isBlueprintPreparedAndNotStarted(uint256 _blueprintID)
        internal
        view
        returns (bool)
    {
        return blueprints[_blueprintID].saleState == SaleState.not_started;
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
        require(proof.length != 0, "no proof provided");
        require(
            !blueprints[_blueprintID].claimedWhitelistedPieces[msg.sender],
            "already claimed"
        );
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

        platform = msg.sender;

        defaultPlatformPrimaryFeePercentage = 500; //5%

        asyncSaleFeesRecipient = msg.sender;
    }

    function prepareBlueprint(
        address _artist,
        uint64 _capacity,
        uint128 _price,
        address _erc20Token,
        string memory _blueprintMetaData,
        string memory _baseTokenUri,
        address[] memory _primaryFeeRecipients,
        uint32[] memory _primaryFeeBPS,
        address[] memory _secondaryFeeRecipients,
        uint32[] memory _secondaryFeeBPS,
        //TODO add secondary sale recipients
        bytes32 _merkleroot,
        uint32 _mintAmountArtist,
        uint32 _mintAmountPlatform
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 _blueprintID = blueprintIndex;
        blueprints[_blueprintID].artist = _artist;
        blueprints[_blueprintID].capacity = _capacity;
        blueprints[_blueprintID].price = _price;
        if (_erc20Token != address(0)) {
            blueprints[_blueprintID].ERC20Token = _erc20Token;
        }
        blueprints[_blueprintID].baseTokenUri = _baseTokenUri;
        if (_primaryFeeRecipients.length != 0 || _primaryFeeBPS.length != 0) {
            require(
                _primaryFeeRecipients.length == _primaryFeeBPS.length,
                "mismatched recipients & Bps"
            );
            uint32 totalPercent;
            for (uint256 i = 0; i < _primaryFeeBPS.length; i++) {
                totalPercent = totalPercent + _primaryFeeBPS[i];
            }
            require(totalPercent <= 10000, "Fee Bps exceed maximum");
            blueprints[_blueprintID]
                .primaryFeeRecipients = _primaryFeeRecipients;
            blueprints[_blueprintID].primaryFeeBPS = _primaryFeeBPS;
        }

        if (_merkleroot != 0) {
            blueprints[_blueprintID].merkleroot = _merkleroot;
        }

        blueprints[_blueprintID].mintAmountArtist = _mintAmountArtist;
        blueprints[_blueprintID].mintAmountPlatform = _mintAmountPlatform;

        blueprints[_blueprintID].saleState = SaleState.not_started;
        //assign the erc721 token index to the blueprint
        blueprints[_blueprintID].erc721TokenIndex = latestErc721TokenIndex;
        latestErc721TokenIndex += _capacity;

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
        uint32 quantity,
        uint256 tokenAmount,
        bytes32[] calldata proof
    )
        external
        payable
        BuyerWhitelistedOrSaleStarted(blueprintID, quantity, proof)
        isQuantityAvailableForPurchase(blueprintID, quantity)
    {
        address _artist = blueprints[blueprintID].artist;
        _confirmPaymentAmountAndSettleSale(
            blueprintID,
            quantity,
            tokenAmount,
            _artist
        );

        _mintQuantity(blueprintID, quantity);

        if (blueprints[blueprintID].saleState == SaleState.not_started) {
            blueprints[blueprintID].claimedWhitelistedPieces[msg.sender] = true;
        }
    }

    function preSaleMint(uint256 blueprintID, uint32 quantity) external {
        require(
            _isBlueprintPreparedAndNotStarted(blueprintID),
            "Must be prepared and not started"
        );
        require(
            platform == msg.sender ||
                blueprints[blueprintID].artist == msg.sender,
            "user cannot mint presale"
        );

        if (platform == msg.sender) {
            require(
                quantity <= blueprints[blueprintID].mintAmountPlatform,
                "cannot mint quantity"
            );
            blueprints[blueprintID].mintAmountPlatform -= quantity;
        } else if (blueprints[blueprintID].artist == msg.sender) {
            require(
                quantity <= blueprints[blueprintID].mintAmountArtist,
                "cannot mint quantity"
            );
            blueprints[blueprintID].mintAmountArtist -= quantity;
        }
        _mintQuantity(blueprintID, quantity);
    }

    /*
     * Iterate and mint each blueprint for user
     */
    function _mintQuantity(uint256 _blueprintID, uint32 _quantity) private {
        uint128 newTokenId = blueprints[_blueprintID].erc721TokenIndex;
        uint64 newCap = blueprints[_blueprintID].capacity;
        for (uint16 i = 0; i < _quantity; i++) {
            _mint(msg.sender, newTokenId + i);
            bytes32 prefixHash = keccak256(
                abi.encodePacked(
                    block.number,
                    block.timestamp,
                    block.coinbase,
                    newCap
                )
            );
            emit BlueprintMinted(
                _blueprintID,
                blueprints[_blueprintID].artist,
                msg.sender,
                newTokenId + i,
                newCap,
                prefixHash
            );
            --newCap;
        }

        blueprints[_blueprintID].erc721TokenIndex += _quantity;
        blueprints[_blueprintID].capacity = newCap;
    }

    function _confirmPaymentAmountAndSettleSale(
        uint256 _blueprintID,
        uint32 _quantity,
        uint256 _tokenAmount,
        address _artist
    ) internal {
        address _erc20Token = blueprints[_blueprintID].ERC20Token;
        uint128 _price = blueprints[_blueprintID].price;
        if (_erc20Token == address(0)) {
            require(_tokenAmount == 0, "cannot specify token amount");
            require(
                msg.value == _quantity * _price,
                "Purchase amount must match price"
            );
            _payFeesAndArtist(_blueprintID, _erc20Token, msg.value, _artist);
        } else {
            require(msg.value == 0, "cannot specify eth amount");
            require(
                _tokenAmount == _quantity * _price,
                "Purchase amount must match price"
            );

            IERC20(_erc20Token).transferFrom(
                msg.sender,
                address(this),
                _tokenAmount
            );
            _payFeesAndArtist(_blueprintID, _erc20Token, _tokenAmount, _artist);
        }
    }

    ////////////////////////////////////
    ////// MERKLEROOT FUNCTIONS ////////
    ////////////////////////////////////

    /**
     * Create a merkle tree with address: quantity pairs as the leaves.
     * The msg.sender will be verified if it has a corresponding quantity value in the merkletree
     */

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
        onlyRole(DEFAULT_ADMIN_ROLE)
        isBlueprintPrepared(blueprintID)
    {
        emit BlueprintSeed(blueprintID, randomSeed);
    }

    function setAsyncFeeRecipient(address _asyncSaleFeesRecipient)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        asyncSaleFeesRecipient = _asyncSaleFeesRecipient;
    }

    function changedefaultPlatformPrimaryFeePercentage(uint32 _basisPoints)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_basisPoints <= 10000);
        defaultPlatformPrimaryFeePercentage = _basisPoints;
    }

    function updatePlatformAddress(address _platform)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(DEFAULT_ADMIN_ROLE, _platform);

        revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
        platform = _platform;
    }

    ////////////////////////////////////
    /// Secondary Fees implementation //
    ////////////////////////////////////

    function _payFeesAndArtist(
        uint256 _blueprintID,
        address _erc20Token,
        uint256 _amount,
        address _artist
    ) internal {
        address[] memory _primaryFeeRecipients = getPrimaryFeeRecipients(
            _blueprintID
        );
        uint32[] memory _primaryFeeBPS = getPrimaryFeeBps(_blueprintID);
        uint256 feesPaid;

        for (uint256 i = 0; i < _primaryFeeRecipients.length; i++) {
            uint256 fee = _getFeePortion(_amount, _primaryFeeBPS[i]);
            feesPaid = feesPaid + fee;
            _payout(_primaryFeeRecipients[i], _erc20Token, fee);
        }

        _payout(_artist, _erc20Token, (_amount - feesPaid));
    }

    function _payout(
        address _recipient,
        address _erc20Token,
        uint256 _amount
    ) internal {
        if (_erc20Token != address(0)) {
            IERC20(_erc20Token).transfer(_recipient, _amount);
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

    function withdrawAllFailedCredits(address payable recipient) external {
        uint256 amount = failedTransferCredits[msg.sender];

        require(amount != 0, "no credits to withdraw");

        failedTransferCredits[msg.sender] = 0;

        (bool successfulWithdraw, ) = recipient.call{value: amount, gas: 20000}(
            ""
        );
        require(successfulWithdraw, "withdraw failed");
    }

    function getPrimaryFeeRecipients(uint256 id)
        public
        view
        returns (address[] memory)
    {
        if (blueprints[id].primaryFeeRecipients.length == 0) {
            address[] memory primaryFeeRecipients = new address[](1);
            primaryFeeRecipients[0] = (asyncSaleFeesRecipient);
            return primaryFeeRecipients;
        } else {
            return blueprints[id].primaryFeeRecipients;
        }
    }

    function getPrimaryFeeBps(uint256 id)
        public
        view
        returns (uint32[] memory)
    {
        if (blueprints[id].primaryFeeBPS.length == 0) {
            uint32[] memory primaryFeeBPS = new uint32[](1);
            primaryFeeBPS[0] = defaultPlatformPrimaryFeePercentage;

            return primaryFeeBPS;
        } else {
            return blueprints[id].primaryFeeBPS;
        }
    }

    function getFeeRecipients(uint256 id)
        public
        view
        override
        returns (address[] memory)
    {
        if (blueprints[id].secondaryFeeRecipients.length == 0) {
            address[] memory feeRecipients = new address[](2);
            feeRecipients[0] = (asyncSaleFeesRecipient);
            feeRecipients[1] = (blueprints[id].artist);

            return feeRecipients;
        } else {
            return blueprints[id].secondaryFeeRecipients;
        }
    }

    function getFeeBps(uint256 id)
        public
        view
        override
        returns (uint32[] memory)
    {
        if (blueprints[id].secondaryFeeBPS.length == 0) {
            uint32[] memory feeBPS = new uint32[](2);
            feeBPS[0] = defaultPlatformSecondarySalePercentage;
            feeBPS[1] = defaultBlueprintSecondarySalePercentage;

            return feeBPS;
        } else {
            return blueprints[id].secondaryFeeBPS;
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
