//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "../CreatorBlueprints.sol";
import "../BlueprintV12.sol";
import "../royalties/interfaces/ISplitMain.sol";
import "../common/IBlueprintTypes.sol";

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @dev Used to deploy and configure CreatorBlueprints contracts in multiple settings
 * @author Ohimire Labs
 */
contract BlueprintsFactory is Ownable {
    /**
     * @dev Emitted when contract is deployed, exposing Async Art system contracts deployed in the process
     * @param creatorBlueprintsImplementation Address of deployed CreatorBlueprints implementation used in beacon upgradability
     * @param creatorBlueprintsBeacon Address of deployed beacon tracking CreatorBlueprints implementation
     * @param blueprintV12Implementation Address of deployed global BlueprintV12 implementation
     * @param blueprintV12Beacon Address of deployed beacon tracking BlueprintV12 implementation
     */
    event FactoryDeployed(
        address creatorBlueprintsImplementation,
        address creatorBlueprintsBeacon,
        address blueprintV12Implementation,
        address blueprintV12Beacon
    );

    /**
     * @dev Emitted when CreatorBlueprint is deployed
     * @param creatorBlueprint Address of deployed CreatorBlueprints BeaconProxy
     * @param royaltySplit Address of associated royalty splitter contract
     * @param blueprintPlatformID Platform's identification of blueprint
     */
    event CreatorBlueprintDeployed(
        address indexed creatorBlueprint,
        address indexed royaltySplit,
        string blueprintPlatformID
    );

    /**
     * @dev Emitted when BlueprintV12 is deployed
     * @param blueprintV12 Address of deployed BlueprintV12 BeaconProxy
     */
    event BlueprintV12Deployed(
        address indexed blueprintV12
    );

    /**
     * @dev Beacon keeping track of current CreatorBlueprint implementation
     */
    address public immutable creatorBlueprintsBeacon;

    /**
     * @dev Beacon keeping track of current BlueprintV12 implementation
     */
    address public immutable blueprintV12Beacon;

    /**
     * @dev System royalty manager
     */
    address private immutable _splitMain;

    /**
     * @dev Set of default addresses to be given privileges in each CreatorBlueprint
     */
    IBlueprintTypes.Admins public defaultCreatorBlueprintsAdmins;

    /**
     * @dev Set of default addresses to be given privileges in each BlueprintV12
     */
    IBlueprintTypes.Admins public defaultBlueprintV12Admins;

    /**
     * @dev This constructor takes a network from raw to a fully deployed AsyncArt Blueprints system
     * @param creatorBlueprintsBeaconUpgrader Account that can upgrade the CreatorBlueprint implementation
     * @param globalBlueprintsBeaconUpgrader Account able to upgrade global BlueprintV12 implementation (via beacon)
     * @param creatorBlueprintsMinter Initial default address assigned MINTER_ROLE on CreatorBlueprints instances
     * @param _platform Address given DEFAULT_ADMIN role on BlueprintV12 and set as initial default address assigned DEFAULT_ADMIN role on CreatorBlueprints instances
     * @param splitMain Royalty manager
     * @param factoryOwner Initial owner of this contract
     */
    constructor(
        address creatorBlueprintsBeaconUpgrader,
        address globalBlueprintsBeaconUpgrader,
        address globalBlueprintsMinter,
        address creatorBlueprintsMinter,
        address _platform,
        address splitMain,
        address factoryOwner
    ) {
        // deploy CreatorBlueprints implementation and beacon
        address creatorBlueprintsImplementation = address(new CreatorBlueprints());
        address _beacon = address(new UpgradeableBeacon(creatorBlueprintsImplementation));
        Ownable(_beacon).transferOwnership(creatorBlueprintsBeaconUpgrader);
        creatorBlueprintsBeacon = _beacon; // extra step, as one cannot read immutable variables in a constructor

        // deploy blueprintV12 implementation and Beacon for it
        address blueprintV12Implementation = address(new BlueprintV12());
        address _globalBeacon = address(new UpgradeableBeacon(blueprintV12Implementation));
        Ownable(_globalBeacon).transferOwnership(globalBlueprintsBeaconUpgrader);
        blueprintV12Beacon = _globalBeacon; // extra step as one cannot read immutable variables in a constructor

        _splitMain = splitMain;

        // start off with both set of default admins being the same
        defaultCreatorBlueprintsAdmins = IBlueprintTypes.Admins(_platform, creatorBlueprintsMinter, _platform);
        defaultBlueprintV12Admins =  IBlueprintTypes.Admins(_platform, globalBlueprintsMinter, _platform);

        _transferOwnership(factoryOwner);

        emit FactoryDeployed(
            creatorBlueprintsImplementation,
            _beacon,
            blueprintV12Implementation,
            _globalBeacon
        );
    }

    /**
     * @dev Deploy BlueprintV12 contract only
     * @param _name Name of BlueprintV12 instance
     * @param _symbol Symbol of BlueprintV12 instance
     */
    function deployGlobalBlueprint(
        string calldata _name,
        string calldata _symbol
    ) external {
        address proxy = address(new BeaconProxy(
            blueprintV12Beacon,
            abi.encodeWithSelector(
                BlueprintV12(address(0)).initialize.selector,
                _name,
                _symbol,
                defaultBlueprintV12Admins,
                _splitMain
            )
        ));

        emit BlueprintV12Deployed(
            proxy
        );
    }

    /**
     * @dev Deploy CreatorBlueprints contract only
     * @param creatorBlueprintsInput Object containing core CreatorBlueprints configuration
     * @param royaltyCutBPS Total percentage of token purchases taken by royalty split on CreatorBlueprint deployed instance
     * @param split Pre-existing royalty splits contract
     * @param blueprintPlatformID Platform's identification of blueprint
     */
    function deployCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        uint32 royaltyCutBPS,
        address split,
        string calldata blueprintPlatformID
    ) external {
        _deployCreatorBlueprints(
            creatorBlueprintsInput,
            royaltyCutBPS,
            split,
            address(0),
            blueprintPlatformID
        );
    }

    /**
     * @dev Deploy CreatorBlueprints and associated royalty splitter contract
     * @param creatorBlueprintsInput Object containing core CreatorBlueprints configuration
     * @param royaltyRecipients Array of royalty recipients to encode into immutable royalty split
     * @param allocations Array of allocations by percentage, given to members in royaltyRecipients
     * @param royaltyCutBPS Total percentage of token purchases taken by royalty split on CreatorBlueprint deployed instance
     * @param blueprintPlatformID Platform's identification of blueprint
     */
    function deployCreatorBlueprintsAndRoyaltySplitter(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        address[] calldata royaltyRecipients,
        uint32[] calldata allocations,
        uint32 royaltyCutBPS,
        string calldata blueprintPlatformID
    ) external {
        address split = ISplitMain(_splitMain).createSplit(
            royaltyRecipients,
            allocations,
            0,
            address(0)
        );

        _deployCreatorBlueprints(
            creatorBlueprintsInput,
            royaltyCutBPS,
            split,
            address(0),
            blueprintPlatformID
        );
    }

    /**
     * @dev Deploy CreatorBlueprints and prepare blueprint on it
     * @param creatorBlueprintsInput Object containing core CreatorBlueprints configuration
     * @param blueprintPreparationConfig Object containing values needed to prepare blueprint
     * @param primaryFees Primary fees data (recipients and allocations)
     * @param royaltyCutBPS Total percentage of token purchases taken by royalty split on CreatorBlueprint deployed instance
     * @param split Pre-existing royalty splits contract
     * @param blueprintPlatformID Platform's identification of blueprint
     */
    function deployAndPrepareCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        IBlueprintTypes.BlueprintPreparationConfig calldata blueprintPreparationConfig,
        IBlueprintTypes.PrimaryFees calldata primaryFees,
        uint32 royaltyCutBPS,
        address split,
        string calldata blueprintPlatformID
    ) external {
        address blueprintContract = _deployCreatorBlueprints(
            creatorBlueprintsInput,
            royaltyCutBPS,
            split,
            address(this),
            blueprintPlatformID
        );

        CreatorBlueprints(blueprintContract).prepareBlueprint(blueprintPreparationConfig, primaryFees);

        // renounce role as minter
        IAccessControlUpgradeable(blueprintContract).renounceRole(keccak256("MINTER_ROLE"), address(this));
    }

    /**
     * @dev Deploy CreatorBlueprints, deploy associated royalty splitter contract, and prepare blueprint
     * @param creatorBlueprintsInput Object containing core CreatorBlueprints configuration
     * @param blueprintPreparationConfig Object containing values needed to prepare blueprint
     * @param primaryFees Primary fees data (recipients and allocations)
     * @param royaltyRecipients Array of royalty recipients to encode into immutable royalty split
     * @param allocations Array of allocations by percentage, given to members in royaltyRecipients
     * @param royaltyCutBPS Total percentage of token purchases taken by royalty split on CreatorBlueprint deployed instance
     * @param blueprintPlatformID Platform's identification of blueprint
     */
    function deployRoyaltySplitterAndPrepareCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        IBlueprintTypes.BlueprintPreparationConfig calldata blueprintPreparationConfig,
        IBlueprintTypes.PrimaryFees calldata primaryFees,
        address[] calldata royaltyRecipients,
        uint32[] calldata allocations,
        uint32 royaltyCutBPS,
        string calldata blueprintPlatformID
    ) external {
        address split = ISplitMain(_splitMain).createSplit(
            royaltyRecipients,
            allocations,
            0,
            address(0)
        );

        address blueprintContract = _deployCreatorBlueprints(
            creatorBlueprintsInput,
            royaltyCutBPS,
            split,
            address(this),
            blueprintPlatformID
        );

        CreatorBlueprints(blueprintContract).prepareBlueprint(blueprintPreparationConfig, primaryFees);

        // renounce role as minter
        IAccessControlUpgradeable(blueprintContract).renounceRole(keccak256("MINTER_ROLE"), address(this));
    }

    /**
     * @dev Used to predict royalty split address deployed via this factory. Result can be encoded into contract-level metadata before deployment.
     * @param royaltyRecipients Array of royalty recipients to encode into immutable royalty split
     * @param allocations Array of allocations by percentage, given to members in royaltyRecipients
     */
    function predictBlueprintsRoyaltiesSplitAddress(
        address[] calldata royaltyRecipients,
        uint32[] calldata allocations
    ) external view returns(address) {
        return ISplitMain(_splitMain).predictImmutableSplitAddress(
            royaltyRecipients,
            allocations,
            0
        );
    }

    /**
     * @dev Deploys CreatorBlueprints contract
     * @param creatorBlueprintsInput Object containing core CreatorBlueprints configuration
     * @param royaltyCutBPS Total percentage of token purchases taken by royalty split on CreatorBlueprint deployed instance
     * @param split Pre-existing royalty splits contract
     * @param extraMinter Extra account given MINTER_ROLE initially on CreatorBlueprint instance. Expected to be revoked in same transaction, if input is non-zero.
     * @param blueprintPlatformID Platform's identification of blueprint
     */
    function _deployCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        uint32 royaltyCutBPS,
        address split,
        address extraMinter,
        string calldata blueprintPlatformID
    ) private returns (address) {
        CreatorBlueprints.RoyaltyParameters memory royaltyParameters = CreatorBlueprints.RoyaltyParameters(split, royaltyCutBPS);
        address creatorBlueprint = address(new BeaconProxy(
            creatorBlueprintsBeacon,
            abi.encodeWithSelector(
                CreatorBlueprints(address(0)).initialize.selector,
                creatorBlueprintsInput,
                defaultCreatorBlueprintsAdmins,
                royaltyParameters,
                extraMinter
            )
        ));

        emit CreatorBlueprintDeployed(
            creatorBlueprint,
            split,
            blueprintPlatformID
        );

        return creatorBlueprint;
    }

    /**
     * @dev Owner-only function to change the default addresses given privileges on CreatorBlueprints instances
     * @param _newDefaultCreatorBlueprintsAdmins New set of default addresses
     */
    function changeDefaultCreatorBlueprintsAdmins(
        IBlueprintTypes.Admins calldata _newDefaultCreatorBlueprintsAdmins
    ) external onlyOwner {
        require(
            _newDefaultCreatorBlueprintsAdmins.platform != address(0) &&
            _newDefaultCreatorBlueprintsAdmins.asyncSaleFeesRecipient != address(0) &&
            _newDefaultCreatorBlueprintsAdmins.minter != address(0),
            "Invalid address"
        );
        defaultCreatorBlueprintsAdmins = _newDefaultCreatorBlueprintsAdmins;
    }

    /**
     * @dev Owner-only function to change the default addresses given privileges on BlueprintV12 instances
     * @param _newDefaultBlueprintV12Admins New set of default addresses
     */
    function changeDefaultBlueprintV12Admins(
        IBlueprintTypes.Admins calldata _newDefaultBlueprintV12Admins
    ) external onlyOwner {
        require(
            _newDefaultBlueprintV12Admins.platform != address(0) &&
            _newDefaultBlueprintV12Admins.asyncSaleFeesRecipient != address(0) &&
            _newDefaultBlueprintV12Admins.minter != address(0),
            "Invalid address"
        );
        defaultBlueprintV12Admins = _newDefaultBlueprintV12Admins;
    }
}