//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "./abstract/HasSecondarySaleFees.sol";
import "./royalties/interfaces/ISplitMain.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BlueprintV12 is
    ERC721Upgradeable,
    HasSecondarySaleFees,
    AccessControlEnumerableUpgradeable,
    ReentrancyGuard
{
    using StringsUpgradeable for uint256;

    uint32 public defaultPlatformPrimaryFeePercentage;    
    uint32 public defaultBlueprintSecondarySalePercentage;
    uint32 public defaultPlatformSecondarySalePercentage;
    uint64 public latestErc721TokenIndex;
    uint256 public blueprintIndex;

    address public asyncSaleFeesRecipient;
    address public platform;
    address public minterAddress;

    address private _splitMain;
    
    mapping(uint256 => uint256) tokenToBlueprintID;
    mapping(address => uint256) failedTransferCredits;
    mapping(uint256 => Blueprints) public blueprints;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    enum SaleState {
        not_prepared,
        not_started,
        started,
        paused
    }

    struct SecondaryFeesInput {
        address[] secondaryFeeRecipients; 
        uint32[] secondaryFeeMPS; // where 100% = 1000000 as per SplitMain
        uint32 totalRoyaltyCutBPS;
        address royaltyRecipient; // if this is set, it is used as the de-facto alternative to secondaryFeeRecipients and secondaryFeeBPS
    }

    // used to bypass stack depth error
    struct FeesInput {
        uint32[] primaryFeeBPS;
        address[] primaryFeeRecipients;
        SecondaryFeesInput secondaryFeesInput;
    } 

    struct Fees {
        address[] primaryFeeRecipients;
        uint32[] primaryFeeBPS;
        address royaltyRecipient;
        uint32 totalRoyaltyCutBPS;
    }

    struct Blueprints {
        uint32 mintAmountArtist;
        uint32 mintAmountPlatform;
        uint64 capacity;
        uint64 erc721TokenIndex;
        uint64 maxPurchaseAmount;
        uint128 saleEndTimestamp;
        uint128 price;
        bool tokenUriLocked;        
        address artist;
        address ERC20Token;
        string baseTokenUri;
        bytes32 merkleroot;
        SaleState saleState;    
        Fees feeRecipientInfo;
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
        string blueprintMetaData,
        string baseTokenUri
    );

    event BlueprintSettingsUpdated(
        uint256 blueprintID,
        uint128 price,
        uint32 newMintAmountArtist,
        uint32 newMintAmountPlatform,
        uint32 newSaleState,
        uint64 newMaxPurchaseAmount,
        uint128 saleEndTimestamp,
        bytes32 newMerkleRoot
    );

    event SaleStarted(uint256 blueprintID);

    event SalePaused(uint256 blueprintID);

    event SaleUnpaused(uint256 blueprintID);

    event BlueprintTokenUriUpdated(uint256 blueprintID, string newBaseTokenUri);

    modifier isBlueprintPrepared(uint256 _blueprintID) {
        require(
            blueprints[_blueprintID].saleState != SaleState.not_prepared,
            "not prepared"
        );
        _;
    }

    modifier isSaleOngoing(uint256 _blueprintID) {
        require(_isSaleOngoing(_blueprintID), "Not ongoing");
        _;
    }

    modifier BuyerWhitelistedOrSaleStarted(
        uint256 _blueprintID,
        uint32 _whitelistedQuantity,
        bytes32[] calldata proof
    ) {
        require(
            // Sale must be ongoing OR
            _isSaleOngoing(_blueprintID) ||
            // Must be presale and a whitelisted user
            (_isBlueprintPreparedAndNotStarted(_blueprintID) && proof.length != 0 && _verify(_leaf(msg.sender, uint256(_whitelistedQuantity)), blueprints[_blueprintID].merkleroot, proof)),
            "purchase unavailable"
        );
        _;
    }

    modifier isQuantityAvailableForPurchase(
        uint256 _blueprintID,
        uint32 _quantity
    ) {
        require(
            blueprints[_blueprintID].capacity >= _quantity,
            "quantity too big"
        );
        _;
    }

    modifier isSaleEndTimestampCurrentlyValid(
        uint128 _saleEndTimestamp
    ) {
        require(_isSaleEndTimestampCurrentlyValid(_saleEndTimestamp), "Sale ended");
        _;
    }

    ///
    ///Initialize the implementation
    ///
    function initialize(
        string memory name_,
        string memory symbol_,
        address minter,
        address _platform,
        address splitMain
    ) public initializer {
        // Intialize parent contracts
        ERC721Upgradeable.__ERC721_init(name_, symbol_);
        HasSecondarySaleFees._initialize();
        AccessControlUpgradeable.__AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, _platform);
        _setupRole(MINTER_ROLE, minter);

        platform = _platform;
        minterAddress = minter;

        defaultPlatformPrimaryFeePercentage = 2000; // 20%

        defaultBlueprintSecondarySalePercentage = 750; // 7.5%
        defaultPlatformSecondarySalePercentage = 250; // 2.5%

        asyncSaleFeesRecipient = _platform;
        _splitMain = splitMain;
    }

    function _isSaleOngoing(uint256 _blueprintID)
        internal
        view
        returns (bool)
    {
        return blueprints[_blueprintID].saleState == SaleState.started && _isSaleEndTimestampCurrentlyValid(blueprints[_blueprintID].saleEndTimestamp);
    }

    function _isSaleEndTimestampCurrentlyValid(uint128 _saleEndTimestamp)
        internal
        view
        returns (bool)
    {
        return _saleEndTimestamp > block.timestamp || _saleEndTimestamp == 0;
    }

    function _isBlueprintPreparedAndNotStarted(uint256 _blueprintID)
        internal
        view
        returns (bool)
    {
        return blueprints[_blueprintID].saleState == SaleState.not_started;
    }

    function feeArrayDataValid(
        address[] memory _feeRecipients,
        uint32[] memory _feeBPS
    ) internal pure returns (bool) {
        require(
            _feeRecipients.length == _feeBPS.length,
            "fee data invalid"
        );
        uint32 totalPercent;
        for (uint256 i; i < _feeBPS.length; i++) {
            totalPercent = totalPercent + _feeBPS[i];
        }
        require(totalPercent <= 10000, "fee bps too big");
        return true;
    }

    function setBlueprintPrepared(
        uint256 _blueprintID,
        string memory _blueprintMetaData
    ) internal {
        blueprints[_blueprintID].saleState = SaleState.not_started;
        //assign the erc721 token index to the blueprint
        blueprints[_blueprintID].erc721TokenIndex = latestErc721TokenIndex;
        uint64 _capacity = blueprints[_blueprintID].capacity;
        latestErc721TokenIndex += _capacity;
        blueprintIndex++;

        emit BlueprintPrepared(
            _blueprintID,
            blueprints[_blueprintID].artist,
            _capacity,
            _blueprintMetaData,
            blueprints[_blueprintID].baseTokenUri
        );
    }

    function setErc20Token(uint256 _blueprintID, address _erc20Token) internal {
        if (_erc20Token != address(0)) {
            blueprints[_blueprintID].ERC20Token = _erc20Token;
        }
    }

    function _setupBlueprint(
        uint256 _blueprintID,
        address _erc20Token,
        string memory _baseTokenUri,
        bytes32 _merkleroot,
        uint32 _mintAmountArtist,
        uint32 _mintAmountPlatform,
        uint64 _maxPurchaseAmount,
        uint128 _saleEndTimestamp
    )   internal 
        isSaleEndTimestampCurrentlyValid(_saleEndTimestamp)
    {
        setErc20Token(_blueprintID, _erc20Token);

        blueprints[_blueprintID].baseTokenUri = _baseTokenUri;

        if (_merkleroot != 0) {
            blueprints[_blueprintID].merkleroot = _merkleroot;
        }

        blueprints[_blueprintID].mintAmountArtist = _mintAmountArtist;
        blueprints[_blueprintID].mintAmountPlatform = _mintAmountPlatform;

        if (_maxPurchaseAmount != 0) {
            blueprints[_blueprintID].maxPurchaseAmount = _maxPurchaseAmount;
        }
        
        if (_saleEndTimestamp != 0) {
            blueprints[_blueprintID].saleEndTimestamp = _saleEndTimestamp;
        }
    }

    function prepareBlueprint(
        address _artist,
        uint64 _capacity,
        uint128 _price,
        address _erc20Token,
        string memory _blueprintMetaData,
        string memory _baseTokenUri,
        bytes32 _merkleroot,
        uint32 _mintAmountArtist,
        uint32 _mintAmountPlatform,
        uint64 _maxPurchaseAmount,
        uint128 _saleEndTimestamp,
        FeesInput memory feesInput
    )   external 
        onlyRole(MINTER_ROLE)
    {
        uint256 _blueprintID = blueprintIndex;
        blueprints[_blueprintID].artist = _artist;
        blueprints[_blueprintID].capacity = _capacity;
        blueprints[_blueprintID].price = _price;

        _setupBlueprint(
            _blueprintID,
            _erc20Token,
            _baseTokenUri,
            _merkleroot,
            _mintAmountArtist,
            _mintAmountPlatform,
            _maxPurchaseAmount,
            _saleEndTimestamp
        ); 

        setBlueprintPrepared(_blueprintID, _blueprintMetaData);
        setFeeRecipients(_blueprintID, feesInput);
    }

    function updateBlueprintArtist (
        uint256 _blueprintID,
        address _newArtist
    ) external onlyRole(MINTER_ROLE) {
        blueprints[_blueprintID].artist = _newArtist;
    }

    function updateBlueprintCapacity (
        uint256 _blueprintID,
        uint64 _newCapacity,
        uint64 _newLatestErc721TokenIndex
    ) external onlyRole(MINTER_ROLE) {
        require(blueprints[_blueprintID].capacity > _newCapacity, "cap too big");

        blueprints[_blueprintID].capacity = _newCapacity;

        latestErc721TokenIndex = _newLatestErc721TokenIndex;
    }

    function setFeeRecipients(
        uint256 _blueprintID,
        FeesInput memory _feesInput
    ) public onlyRole(MINTER_ROLE) {
        require(
            blueprints[_blueprintID].saleState != SaleState.not_prepared,
            "never prepared"
        );
        require(
            feeArrayDataValid(_feesInput.primaryFeeRecipients, _feesInput.primaryFeeBPS),
            "invalid primary data"
        ); 

        SecondaryFeesInput memory secondaryFeesInput = _feesInput.secondaryFeesInput;

        Fees memory feeRecipientInfo = Fees(
            _feesInput.primaryFeeRecipients,
            _feesInput.primaryFeeBPS,
            secondaryFeesInput.royaltyRecipient, 
            secondaryFeesInput.totalRoyaltyCutBPS
        );

        // if pre-existing split isn't passed in, deploy it and set it. 
        if (feeRecipientInfo.royaltyRecipient == address(0)) {
            feeRecipientInfo.royaltyRecipient = ISplitMain(_splitMain).createSplit(
                secondaryFeesInput.secondaryFeeRecipients, 
                secondaryFeesInput.secondaryFeeMPS, 
                0, 
                address(0) // immutable split
            );
        } 
        
        blueprints[_blueprintID].feeRecipientInfo = feeRecipientInfo;
    }

    function beginSale(uint256 blueprintID)
        external
        onlyRole(MINTER_ROLE)
        isSaleEndTimestampCurrentlyValid(blueprints[blueprintID].saleEndTimestamp) 
    {
        require(
            blueprints[blueprintID].saleState == SaleState.not_started,
            "wrong sale state"
        );
        blueprints[blueprintID].saleState = SaleState.started;
        emit SaleStarted(blueprintID);
    }

    function pauseSale(uint256 blueprintID)
        external
        onlyRole(MINTER_ROLE)
        isSaleOngoing(blueprintID)
    {
        blueprints[blueprintID].saleState = SaleState.paused;
        emit SalePaused(blueprintID);
    }

    function unpauseSale(uint256 blueprintID) external onlyRole(MINTER_ROLE) isSaleEndTimestampCurrentlyValid(blueprints[blueprintID].saleEndTimestamp) {
        require(
            blueprints[blueprintID].saleState == SaleState.paused,
            "Sale not paused"
        );
        blueprints[blueprintID].saleState = SaleState.started;
        emit SaleUnpaused(blueprintID);
    }

    function _updateMerkleRootForPurchase(
        uint256 blueprintID,
        bytes32[] memory oldProof,
        uint32 remainingWhitelistAmount
    ) 
        internal
    {
        bool[] memory proofFlags = new bool[](oldProof.length);
        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = _leaf(msg.sender, uint256(remainingWhitelistAmount));
        blueprints[blueprintID].merkleroot = MerkleProof.processMultiProof(oldProof, proofFlags, leaves);
    }

    function purchaseBlueprintsTo(
        uint256 blueprintID,
        uint32 purchaseQuantity,
        uint32 whitelistedQuantity,
        uint256 tokenAmount,
        bytes32[] calldata proof,
        address nftRecipient
    )
        external
        payable
        nonReentrant
        BuyerWhitelistedOrSaleStarted(blueprintID, whitelistedQuantity, proof)
        isQuantityAvailableForPurchase(blueprintID, purchaseQuantity)
    {
        require(purchaseQuantity <= whitelistedQuantity, "over whitelisted amount");
        require(
            blueprints[blueprintID].maxPurchaseAmount == 0 ||
                purchaseQuantity <= blueprints[blueprintID].maxPurchaseAmount,
            "over maxPurchaseAmount"
        );

        address artist = blueprints[blueprintID].artist;
        _confirmPaymentAmountAndSettleSale(
            blueprintID,
            purchaseQuantity,
            tokenAmount,
            artist
        );
        _mintQuantity(blueprintID, purchaseQuantity, nftRecipient);
        _updateMerkleRootForPurchase(blueprintID, proof, whitelistedQuantity - purchaseQuantity);
    }

    function purchaseBlueprints(
        uint256 blueprintID,
        uint32 purchaseQuantity,
        uint32 whitelistedQuantity,
        uint256 tokenAmount,
        bytes32[] calldata proof
    )
        external
        payable
        nonReentrant
        BuyerWhitelistedOrSaleStarted(blueprintID, whitelistedQuantity, proof)
        isQuantityAvailableForPurchase(blueprintID, purchaseQuantity)
    {
        require(purchaseQuantity <= whitelistedQuantity, "over whitelisted amount");
        require(
            blueprints[blueprintID].maxPurchaseAmount == 0 ||
                purchaseQuantity <= blueprints[blueprintID].maxPurchaseAmount,
            "over maxPurchaseAmount"
        );

        address artist = blueprints[blueprintID].artist;
        _confirmPaymentAmountAndSettleSale(
            blueprintID,
            purchaseQuantity,
            tokenAmount,
            artist
        );

        _mintQuantity(blueprintID, purchaseQuantity, msg.sender);
        _updateMerkleRootForPurchase(blueprintID, proof, whitelistedQuantity - purchaseQuantity);
    }

    function artistMint(
        uint256 blueprintID,
        uint32 quantity
    )
        external
        nonReentrant 
    {
        require(
            _isBlueprintPreparedAndNotStarted(blueprintID) || _isSaleOngoing(blueprintID),
            "Must be presale or public sale"
        );
        require(
            minterAddress == msg.sender ||
                blueprints[blueprintID].artist == msg.sender,
            "user cannot mint presale"
        );

        if (minterAddress == msg.sender) {
            require(
                quantity <= blueprints[blueprintID].mintAmountPlatform,
                "can't mint quantity"
            );
            blueprints[blueprintID].mintAmountPlatform -= quantity;
        } else if (blueprints[blueprintID].artist == msg.sender) {
            require(
                quantity <= blueprints[blueprintID].mintAmountArtist,
                "can't mint quantity"
            );
            blueprints[blueprintID].mintAmountArtist -= quantity;
        }
        _mintQuantity(blueprintID, quantity, msg.sender);
    }

    /*
     * Iterate and mint each blueprint for user
     */
    function _mintQuantity(uint256 _blueprintID, uint32 _quantity, address _nftRecipient) private {
        uint128 newTokenId = blueprints[_blueprintID].erc721TokenIndex;
        uint64 newCap = blueprints[_blueprintID].capacity;
        for (uint16 i; i < _quantity; i++) {
            require(newCap > 0, "quantity > cap");
            
            _mint(_nftRecipient, newTokenId + i);
            tokenToBlueprintID[newTokenId + i] = _blueprintID;

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
                _nftRecipient,
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
            require(_tokenAmount == 0, "tokenAmount not zero");
            require(
                msg.value == _quantity * _price,
                "incorrect payment amount"
            );
            _payFeesAndArtist(_blueprintID, _erc20Token, msg.value, _artist);
        } else {
            require(msg.value == 0, "eth value not zero");
            require(
                _tokenAmount == _quantity * _price,
                "incorrect payment amount"
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

    function updateBlueprintTokenUri(
        uint256 blueprintID,
        string memory newBaseTokenUri
    ) external onlyRole(MINTER_ROLE) isBlueprintPrepared(blueprintID) {
        require(
            !blueprints[blueprintID].tokenUriLocked,
            "URI locked"
        );

        blueprints[blueprintID].baseTokenUri = newBaseTokenUri;

        emit BlueprintTokenUriUpdated(blueprintID, newBaseTokenUri);
    }

    function lockBlueprintTokenUri(uint256 blueprintID)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        isBlueprintPrepared(blueprintID)
    {
        require(
            !blueprints[blueprintID].tokenUriLocked,
            "URI locked"
        );

        blueprints[blueprintID].tokenUriLocked = true;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "nonexistent token"
        );

        string memory baseURI = blueprints[tokenToBlueprintID[tokenId]].baseTokenUri;
        return
            bytes(baseURI).length > 0
                ? string(
                    abi.encodePacked(
                        baseURI,
                        "/",
                        tokenId.toString(),
                        "/",
                        "token.json"
                    )
                )
                : "";
    }

    function revealBlueprintSeed(uint256 blueprintID, string memory randomSeed)
        external
        onlyRole(MINTER_ROLE)
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

    function changeDefaultPlatformPrimaryFeePercentage(uint32 _basisPoints)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_basisPoints <= 10000);
        defaultPlatformPrimaryFeePercentage = _basisPoints;
    }

    function changeDefaultBlueprintSecondarySalePercentage(uint32 _basisPoints)
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

    function updatePlatformAddress(address _platform)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(DEFAULT_ADMIN_ROLE, _platform);

        revokeRole(DEFAULT_ADMIN_ROLE, platform);
        platform = _platform;
    }

    // Allows the platform to change the minter address
    function updateMinterAddress(address newMinterAddress)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(MINTER_ROLE, newMinterAddress);

        revokeRole(MINTER_ROLE, minterAddress);
        minterAddress = newMinterAddress;
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

        for (uint256 i; i < _primaryFeeRecipients.length; i++) {
            uint256 fee = (_amount * _primaryFeeBPS[i])/10000;
            feesPaid = feesPaid + fee;
            _payout(_primaryFeeRecipients[i], _erc20Token, fee);
        }
        if (_amount - feesPaid > 0) {
            _payout(_artist, _erc20Token, (_amount - feesPaid));
        }
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

        require(amount != 0, "no credits");

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
        if (blueprints[id].feeRecipientInfo.primaryFeeRecipients.length == 0) {
            address[] memory primaryFeeRecipients = new address[](1);
            primaryFeeRecipients[0] = (asyncSaleFeesRecipient);
            return primaryFeeRecipients;
        } else {
            return blueprints[id].feeRecipientInfo.primaryFeeRecipients;
        }
    }

    function getPrimaryFeeBps(uint256 id)
        public
        view
        returns (uint32[] memory)
    {
        if (blueprints[id].feeRecipientInfo.primaryFeeBPS.length == 0) {
            uint32[] memory primaryFeeBPS = new uint32[](1);
            primaryFeeBPS[0] = defaultPlatformPrimaryFeePercentage;

            return primaryFeeBPS;
        } else {
            return blueprints[id].feeRecipientInfo.primaryFeeBPS;
        }
    }

    function getFeeRecipients(uint256 tokenId)
        public
        view
        override
        returns (address[] memory)
    {
        address[] memory feeRecipients = new address[](1);
        feeRecipients[0] = blueprints[tokenToBlueprintID[tokenId]].feeRecipientInfo.royaltyRecipient;
    }

    function getFeeBps(uint256 tokenId)
        public
        view
        override
        returns (uint32[] memory)
    {
        uint32[] memory feeBPS  = new uint32[](1);
        feeBPS[0] = blueprints[tokenToBlueprintID[tokenId]].feeRecipientInfo.totalRoyaltyCutBPS;
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
            hasRole(DEFAULT_ADMIN_ROLE, operator);
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
            interfaceId == type(HasSecondarySaleFees).interfaceId ||
            ERC721Upgradeable.supportsInterface(interfaceId) ||
            ERC165StorageUpgradeable.supportsInterface(interfaceId) ||
            AccessControlEnumerableUpgradeable.supportsInterface(interfaceId);
    }
}