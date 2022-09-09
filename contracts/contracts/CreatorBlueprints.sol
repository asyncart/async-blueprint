//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "./abstract/HasSecondarySaleFees.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CreatorBlueprints is
    ERC721Upgradeable,
    HasSecondarySaleFees,
    AccessControlEnumerableUpgradeable,
    ReentrancyGuard
{
    using StringsUpgradeable for uint256;

    uint32 public defaultPlatformPrimaryFeePercentage;    
    uint64 public latestErc721TokenIndex;

    address public asyncSaleFeesRecipient;
    address public platform;
    address public minterAddress;
    address public artist;
    
    mapping(address => uint256) failedTransferCredits;
    Blueprints public blueprint;
    RoyaltyParameters public royaltyParameters;

    string public contractURI; 

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    enum SaleState {
        not_prepared,
        not_started,
        started,
        paused
    }

    struct Fees {
        uint32[] primaryFeeBPS;
        address[] primaryFeeRecipients;
    }

    struct RoyaltyParameters {
        address split;
        uint32 royaltyCutBPS;
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
        address ERC20Token;
        string baseTokenUri;
        bytes32 merkleroot;
        SaleState saleState;    
        Fees feeRecipientInfo;
    }

    struct BlueprintPreparationConfig {
        uint64 _capacity;
        uint128 _price;
        address _erc20Token;
        string _blueprintMetaData;
        string _baseTokenUri;
        bytes32 _merkleroot;
        uint32 _mintAmountArtist;
        uint32 _mintAmountPlatform;
        uint64 _maxPurchaseAmount;
        uint128 _saleEndTimestamp;
        Fees _feeRecipientInfo; 
    }
    struct CreatorBlueprintsInput {
        string name;
        string symbol;
        string contractURI;
        address artist;
    }

    struct CreatorBlueprintsAdmins {
        address platform;
        address minter;
        address asyncSaleFeesRecipient;
    }

    event BlueprintSeed(string randomSeed);

    event BlueprintMinted(
        address artist,
        address purchaser,
        uint128 tokenId,
        uint64 newCapacity,
        bytes32 seedPrefix
    );

    event BlueprintPrepared(
        address artist,
        uint64 capacity,
        string blueprintMetaData,
        string baseTokenUri
    );

    event BlueprintSettingsUpdated(
        uint128 price,
        uint32 newMintAmountArtist,
        uint32 newMintAmountPlatform,
        uint32 newSaleState,
        uint64 newMaxPurchaseAmount,
        uint128 saleEndTimestamp,
        bytes32 newMerkleRoot
    );

    event SaleStarted();

    event SalePaused();

    event SaleUnpaused();

    event BlueprintTokenUriUpdated(string newBaseTokenUri);

    modifier isBlueprintPrepared() {
        require(
            blueprint.saleState != SaleState.not_prepared,
            "not prepared"
        );
        _;
    }

    modifier isSaleOngoing() {
        require(_isSaleOngoing(), "Sale not ongoing");
        _;
    }

    modifier BuyerWhitelistedOrSaleStarted(
        uint32 _whitelistedQuantity,
        bytes32[] calldata proof
    ) {
        require(
            // Sale must be ongoing OR
            _isSaleOngoing() ||
            // Must be presale and a whitelisted user
            (_isBlueprintPreparedAndNotStarted() && proof.length != 0 && _verify(_leaf(msg.sender, uint256(_whitelistedQuantity)), blueprint.merkleroot, proof)),
            "not available to purchase"
        );
        _;
    }

    modifier isQuantityAvailableForPurchase(
        uint32 _quantity
    ) {
        require(
            blueprint.capacity >= _quantity,
            "quantity exceeds capacity"
        );
        _;
    }

    modifier isSaleEndTimestampCurrentlyValid(
        uint128 _saleEndTimestamp
    ) {
        require(_isSaleEndTimestampCurrentlyValid(_saleEndTimestamp), "Sale ended");
        _;
    }

    // allow 0 values for cut and split address  
    modifier validRoyaltyParameters(
        RoyaltyParameters calldata _royaltyParameters
    ) {
        require(_royaltyParameters.royaltyCutBPS <= 10000);
        _;
    }

    ///
    ///Initialize the implementation
    ///
    function initialize(
        CreatorBlueprintsInput calldata creatorBlueprintsInput,
        CreatorBlueprintsAdmins calldata creatorBlueprintsAdmins,
        RoyaltyParameters calldata _royaltyParameters,
        address extraMinter
    ) public initializer validRoyaltyParameters(_royaltyParameters) {
        // Intialize parent contracts
        ERC721Upgradeable.__ERC721_init(creatorBlueprintsInput.name, creatorBlueprintsInput.symbol);
        HasSecondarySaleFees._initialize();
        AccessControlUpgradeable.__AccessControl_init();

        _setupRole(DEFAULT_ADMIN_ROLE, creatorBlueprintsAdmins.platform);
        _setupRole(MINTER_ROLE, creatorBlueprintsAdmins.minter);
        if (extraMinter != address(0)) {
            _setupRole(MINTER_ROLE, extraMinter);
        }

        platform = creatorBlueprintsAdmins.platform;
        minterAddress = creatorBlueprintsAdmins.minter;
        artist = creatorBlueprintsInput.artist;

        defaultPlatformPrimaryFeePercentage = 2000; // 20%

        asyncSaleFeesRecipient = creatorBlueprintsAdmins.asyncSaleFeesRecipient;
        contractURI = creatorBlueprintsInput.contractURI; 
        royaltyParameters = _royaltyParameters;
    }

    function _isSaleOngoing()
        internal
        view
        returns (bool)
    {
        return blueprint.saleState == SaleState.started && _isSaleEndTimestampCurrentlyValid(blueprint.saleEndTimestamp);
    }

    function _isSaleEndTimestampCurrentlyValid(uint128 _saleEndTimestamp)
        internal
        view
        returns (bool)
    {
        return _saleEndTimestamp > block.timestamp || _saleEndTimestamp == 0;
    }

    function _isBlueprintPreparedAndNotStarted()
        internal
        view
        returns (bool)
    {
        return blueprint.saleState == SaleState.not_started;
    }

    function feeArrayDataValid(
        address[] memory _feeRecipients,
        uint32[] memory _feeBPS
    ) internal pure returns (bool) {
        require(
            _feeRecipients.length == _feeBPS.length,
            "mismatched recipients & Bps"
        );
        uint32 totalPercent;
        for (uint256 i; i < _feeBPS.length; i++) {
            totalPercent = totalPercent + _feeBPS[i];
        }
        require(totalPercent <= 10000, "Fee Bps > maximum");
        return true;
    }

    function setBlueprintPrepared(
        string memory _blueprintMetaData
    ) internal {
        blueprint.saleState = SaleState.not_started;
        //assign the erc721 token index to the blueprint
        blueprint.erc721TokenIndex = latestErc721TokenIndex;
        uint64 _capacity = blueprint.capacity;
        latestErc721TokenIndex += _capacity;

        emit BlueprintPrepared(
            artist,
            _capacity,
            _blueprintMetaData,
            blueprint.baseTokenUri
        );
    }

    function setErc20Token(address _erc20Token) internal {
        if (_erc20Token != address(0)) {
            blueprint.ERC20Token = _erc20Token;
        }
    }

    function _setupBlueprint(
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
        setErc20Token(_erc20Token);

        blueprint.baseTokenUri = _baseTokenUri;

        if (_merkleroot != 0) {
            blueprint.merkleroot = _merkleroot;
        }

        blueprint.mintAmountArtist = _mintAmountArtist;
        blueprint.mintAmountPlatform = _mintAmountPlatform;

        if (_maxPurchaseAmount != 0) {
            blueprint.maxPurchaseAmount = _maxPurchaseAmount;
        }
        
        if (_saleEndTimestamp != 0) {
            blueprint.saleEndTimestamp = _saleEndTimestamp;
        }
    }

    function prepareBlueprint(
        BlueprintPreparationConfig calldata config
    )   external 
        onlyRole(MINTER_ROLE)
    {
        blueprint.capacity = config._capacity;
        blueprint.price = config._price;

        _setupBlueprint(
            config._erc20Token,
            config._baseTokenUri,
            config._merkleroot,
            config._mintAmountArtist,
            config._mintAmountPlatform,
            config._maxPurchaseAmount,
            config._saleEndTimestamp
        );

        setBlueprintPrepared(config._blueprintMetaData);
        setFeeRecipients(config._feeRecipientInfo);
    }

    function updateBlueprintArtist (
        address _newArtist
    ) external onlyRole(MINTER_ROLE) {
        artist = _newArtist;
    }

    function updateBlueprintCapacity (
        uint64 _newCapacity,
        uint64 _newLatestErc721TokenIndex
    ) external onlyRole(MINTER_ROLE) {
        require(blueprint.capacity > _newCapacity, "New cap too large");

        blueprint.capacity = _newCapacity;

        latestErc721TokenIndex = _newLatestErc721TokenIndex;
    }

    function setFeeRecipients(
        Fees memory _feeRecipientInfo
    ) public onlyRole(MINTER_ROLE) {
        require(
            blueprint.saleState != SaleState.not_prepared,
            "never prepared"
        );
        if (feeArrayDataValid(_feeRecipientInfo.primaryFeeRecipients, _feeRecipientInfo.primaryFeeBPS)) {
            blueprint.feeRecipientInfo = _feeRecipientInfo;
        }
    }

    function beginSale()
        external
        onlyRole(MINTER_ROLE)
        isSaleEndTimestampCurrentlyValid(blueprint.saleEndTimestamp) 
    {
        require(
            blueprint.saleState == SaleState.not_started,
            "sale started or not prepared"
        );
        blueprint.saleState = SaleState.started;
        emit SaleStarted();
    }

    function pauseSale()
        external
        onlyRole(MINTER_ROLE)
        isSaleOngoing()
    {
        blueprint.saleState = SaleState.paused;
        emit SalePaused();
    }

    function unpauseSale() external onlyRole(MINTER_ROLE) isSaleEndTimestampCurrentlyValid(blueprint.saleEndTimestamp) {
        require(
            blueprint.saleState == SaleState.paused,
            "Sale not paused"
        );
        blueprint.saleState = SaleState.started;
        emit SaleUnpaused();
    }

    function _updateMerkleRootForPurchase(
        bytes32[] memory oldProof,
        uint32 remainingWhitelistAmount
    ) 
        internal
    {
        bool[] memory proofFlags = new bool[](oldProof.length);
        bytes32[] memory leaves = new bytes32[](1);
        leaves[0] = _leaf(msg.sender, uint256(remainingWhitelistAmount));
        blueprint.merkleroot = MerkleProof.processMultiProof(oldProof, proofFlags, leaves);
    }

    function purchaseBlueprintsTo(
        uint32 purchaseQuantity,
        uint32 whitelistedQuantity,
        uint256 tokenAmount,
        bytes32[] calldata proof,
        address nftRecipient
    )
        external
        payable
        nonReentrant
        BuyerWhitelistedOrSaleStarted(whitelistedQuantity, proof)
        isQuantityAvailableForPurchase(purchaseQuantity)
    {
        require(purchaseQuantity <= whitelistedQuantity, "cannot purchase > whitelisted amount");
        require(
            blueprint.maxPurchaseAmount == 0 ||
                purchaseQuantity <= blueprint.maxPurchaseAmount,
            "cannot buy > maxPurchaseAmount in one tx"
        );

        _confirmPaymentAmountAndSettleSale(
            purchaseQuantity,
            tokenAmount,
            artist
        );
        _mintQuantity(purchaseQuantity, nftRecipient);
        _updateMerkleRootForPurchase(proof, whitelistedQuantity - purchaseQuantity);
    }

    function purchaseBlueprints(
        uint32 purchaseQuantity,
        uint32 whitelistedQuantity,
        uint256 tokenAmount,
        bytes32[] calldata proof
    )
        external
        payable
        nonReentrant
        BuyerWhitelistedOrSaleStarted(whitelistedQuantity, proof)
        isQuantityAvailableForPurchase(purchaseQuantity)
    {
        require(purchaseQuantity <= whitelistedQuantity, "cannot purchase > whitelisted amount");
        require(
            blueprint.maxPurchaseAmount == 0 ||
                purchaseQuantity <= blueprint.maxPurchaseAmount,
            "cannot buy > maxPurchaseAmount in one tx"
        );

        _confirmPaymentAmountAndSettleSale(
            purchaseQuantity,
            tokenAmount,
            artist
        );

        _mintQuantity(purchaseQuantity, msg.sender);
        _updateMerkleRootForPurchase(proof, whitelistedQuantity - purchaseQuantity);
    }

    function artistMint(
        uint32 quantity
    )
        external
        nonReentrant 
    {
        address _artist = artist; // cache
        require(
            _isBlueprintPreparedAndNotStarted() || _isSaleOngoing(),
            "Must be presale or public sale"
        );
        require(
            minterAddress == msg.sender ||
                _artist == msg.sender,
            "user cannot mint presale"
        );

        if (minterAddress == msg.sender) {
            require(
                quantity <= blueprint.mintAmountPlatform,
                "cannot mint quantity"
            );
            blueprint.mintAmountPlatform -= quantity;
        } else if (_artist == msg.sender) {
            require(
                quantity <= blueprint.mintAmountArtist,
                "cannot mint quantity"
            );
            blueprint.mintAmountArtist -= quantity;
        }
        _mintQuantity(quantity, msg.sender);
    }

    /*
     * Iterate and mint each blueprint for user
     */
    function _mintQuantity(uint32 _quantity, address _nftRecipient) private {
        uint128 newTokenId = blueprint.erc721TokenIndex;
        uint64 newCap = blueprint.capacity;
        for (uint16 i; i < _quantity; i++) {
            require(newCap > 0, "quantity > cap");
            
            _mint(_nftRecipient, newTokenId + i);

            bytes32 prefixHash = keccak256(
                abi.encodePacked(
                    block.number,
                    block.timestamp,
                    block.coinbase,
                    newCap
                )
            );
            emit BlueprintMinted(
                artist,
                _nftRecipient,
                newTokenId + i,
                newCap,
                prefixHash
            );
            --newCap;
        }

        blueprint.erc721TokenIndex += _quantity;
        blueprint.capacity = newCap;
    }

    function _confirmPaymentAmountAndSettleSale(
        uint32 _quantity,
        uint256 _tokenAmount,
        address _artist
    ) internal {
        address _erc20Token = blueprint.ERC20Token;
        uint128 _price = blueprint.price;
        if (_erc20Token == address(0)) {
            require(_tokenAmount == 0, "cannot specify token amount");
            require(
                msg.value == _quantity * _price,
                "Purchase amount must match price"
            );
            _payFeesAndArtist(_erc20Token, msg.value, _artist);
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
            _payFeesAndArtist(_erc20Token, _tokenAmount, _artist);
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
        string memory newBaseTokenUri
    ) external onlyRole(MINTER_ROLE) isBlueprintPrepared() {
        require(
            !blueprint.tokenUriLocked,
            "URI locked"
        );

        blueprint.baseTokenUri = newBaseTokenUri;

        emit BlueprintTokenUriUpdated(newBaseTokenUri);
    }

    function lockBlueprintTokenUri()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        isBlueprintPrepared()
    {
        require(
            !blueprint.tokenUriLocked,
            "URI locked"
        );

        blueprint.tokenUriLocked = true;
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
            "URI query for nonexistent token"
        );

        string memory baseURI = blueprint.baseTokenUri;
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

    function revealBlueprintSeed(string memory randomSeed)
        external
        onlyRole(MINTER_ROLE)
        isBlueprintPrepared()
    {
        emit BlueprintSeed(randomSeed);
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

    function updateRoyaltyParameters(RoyaltyParameters calldata _royaltyParameters) 
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        validRoyaltyParameters(_royaltyParameters)
    {
        royaltyParameters = _royaltyParameters; 
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
        address _erc20Token,
        uint256 _amount,
        address _artist
    ) internal {
        address[] memory _primaryFeeRecipients = getPrimaryFeeRecipients();
        uint32[] memory _primaryFeeBPS = getPrimaryFeeBps();
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

        require(amount != 0, "no credits to withdraw");

        failedTransferCredits[msg.sender] = 0;

        (bool successfulWithdraw, ) = recipient.call{value: amount, gas: 20000}(
            ""
        );
        require(successfulWithdraw, "withdraw failed");
    }

    function getPrimaryFeeRecipients()
        public
        view
        returns (address[] memory)
    {
        if (blueprint.feeRecipientInfo.primaryFeeRecipients.length == 0) {
            address[] memory primaryFeeRecipients = new address[](1);
            primaryFeeRecipients[0] = (asyncSaleFeesRecipient);
            return primaryFeeRecipients;
        } else {
            return blueprint.feeRecipientInfo.primaryFeeRecipients;
        }
    }

    function getPrimaryFeeBps()
        public
        view
        returns (uint32[] memory)
    {
        if (blueprint.feeRecipientInfo.primaryFeeBPS.length == 0) {
            uint32[] memory primaryFeeBPS = new uint32[](1);
            primaryFeeBPS[0] = defaultPlatformPrimaryFeePercentage;

            return primaryFeeBPS;
        } else {
            return blueprint.feeRecipientInfo.primaryFeeBPS;
        }
    }

    // ignore unused tokenId
    function getFeeRecipients(uint256 tokenId)
        public
        view
        override
        returns (address[] memory)
    {
        address[] memory feeRecipients = new address[](1);
        feeRecipients[0] = royaltyParameters.split;
        return feeRecipients;
    }

    // ignore unused tokenId
    function getFeeBps(uint256 tokenId)
        public
        view
        override
        returns (uint32[] memory)
    {
        uint32[] memory feeBps = new uint32[](1);
        feeBps[0] = royaltyParameters.royaltyCutBPS;
        return feeBps;
    }

    // ERC-2981, ignore token id
    function royaltyInfo(
        uint256 _tokenId,
        uint256 _salePrice
    ) external view returns (
        address receiver,
        uint256 royaltyAmount
    ) {
        receiver = royaltyParameters.split;
        royaltyAmount = _salePrice * royaltyParameters.royaltyCutBPS / 10000;
    }

    // used for interoperability purposes 
    function owner() public view virtual returns (address) {
        return platform;
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