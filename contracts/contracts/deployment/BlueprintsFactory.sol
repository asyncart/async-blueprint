//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "../CreatorBlueprints.sol"; 
import "../BlueprintV12.sol"; 
import "../royalties/interfaces/ISplitMain.sol";

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
     * @param beacon Address of deployed beacon used in beacon upgradibility 
     * @param blueprintV12Implementation Address of deployed global BlueprintV12 implementation 
     * @param globalBlueprints Address of BlueprintV12 (proxy)
     */
    event FactoryDeployed(
        address creatorBlueprintsImplementation, 
        address beacon,
        address blueprintV12Implementation,
        address globalBlueprints
    );

    /**
     * @dev Emitted when CreatorBlueprint is deployed
     * @param creatorBlueprint Address of deployed CreatorBlueprints BeaconProxy 
     * @param royaltySplit Address of associated royalty splitter contract
     */
    event CreatorBlueprintDeployed(
        address creatorBlueprint,
        address royaltySplit
    );

    /**
     * @dev Beacon keeping track of current CreatorBlueprint implementation
     */
    address public immutable beacon; 

    /**
     * @dev System royalty manager
     */
    address private immutable _splitMain;

    /**
     * @dev Set of default addresses to be given privileges in each CreatorBlueprint 
     */
    CreatorBlueprints.CreatorBlueprintsAdmins public defaultCreatorBlueprintsAdmins;

    /**
     * @dev This constructor takes a network from raw to a fully deployed AsyncArt Blueprints system
     * @param beaconUpgrader Account that can upgrade the CreatorBlueprint implementation 
     * @param globalBlueprintsUpgrader Account able to upgrade global BlueprintV12
     * @param globalBlueprintsName Name of BlueprintV12 contract
     * @param globalBlueprintsSymbol Symbol of BlueprintV12 contract 
     * @param globalBlueprintsMinter Minter on BlueprintV12 instance
     * @param creatorBlueprintsMinter Initial default address assigned MINTER_ROLE on CreatorBlueprints instances
     * @param _platform Address given DEFAULT_ADMIN role on BlueprintV12 and set as initial default address assigned DEFAULT_ADMIN role on CreatorBlueprints instances
     * @param splitMain Royalty manager
     * @param factoryOwner Initial owner of this contract 
     */
    constructor(
        address beaconUpgrader, 
        address globalBlueprintsUpgrader,
        string memory globalBlueprintsName,
        string memory globalBlueprintsSymbol,
        address globalBlueprintsMinter,
        address creatorBlueprintsMinter,
        address _platform,
        address splitMain,
        address factoryOwner
    ) {
        // deploy CreatorBlueprints implementation and beacon 
        address creatorBlueprintsImplementation = address(new CreatorBlueprints()); 
        address _beacon = address(new UpgradeableBeacon(creatorBlueprintsImplementation)); 
        Ownable(_beacon).transferOwnership(beaconUpgrader);
        beacon = _beacon; // extra step, as one cannot read immutable variables in a constructor

        // deploy blueprintV12 implementation and TransparentUpgradeableProxy for it
        address blueprintV12Implementation = address(new BlueprintV12()); 
        address proxy = address(new TransparentUpgradeableProxy(
            blueprintV12Implementation,
            globalBlueprintsUpgrader,
            abi.encodeWithSelector(
                BlueprintV12(address(0)).initialize.selector,
                globalBlueprintsName,
                globalBlueprintsSymbol,
                globalBlueprintsMinter,
                _platform,
                splitMain           
            )
        ));

        _splitMain = splitMain; 
        defaultCreatorBlueprintsAdmins = CreatorBlueprints.CreatorBlueprintsAdmins(_platform, _platform, creatorBlueprintsMinter);

        _transferOwnership(factoryOwner);

        emit FactoryDeployed(
            creatorBlueprintsImplementation, 
            _beacon,
            blueprintV12Implementation,
            proxy            
        );
    }

    /**
     * @dev Deploy CreatorBlueprints contract only
     * @param creatorBlueprintsInput Object containing core CreatorBlueprints configuration 
     * @param royaltyCutBPS Total percentage of token purchases taken by royalty split on CreatorBlueprint deployed instance
     * @param split Pre-existing royalty splits contract
     */
    function deployCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        uint32 royaltyCutBPS,
        address split
    ) external {
        _deployCreatorBlueprints(
            creatorBlueprintsInput,
            royaltyCutBPS,
            split,
            address(0)
        );
    }

    /**
     * @dev Deploy CreatorBlueprints and associated royalty splitter contract 
     * @param creatorBlueprintsInput Object containing core CreatorBlueprints configuration 
     * @param royaltyRecipients Array of royalty recipients to encode into immutable royalty split
     * @param allocations Array of allocations by percentage, given to members in royaltyRecipients 
     * @param royaltyCutBPS Total percentage of token purchases taken by royalty split on CreatorBlueprint deployed instance
     */
    function deployCreatorBlueprintsAndRoyaltySplitter(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        address[] calldata royaltyRecipients, 
        uint32[] calldata allocations,
        uint32 royaltyCutBPS
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
            address(0)
        );
    }

    /**
     * @dev Deploy CreatorBlueprints and prepare blueprint on it 
     * @param creatorBlueprintsInput Object containing core CreatorBlueprints configuration 
     * @param blueprintPreparationConfig Object containing all values needed to prepare blueprint
     * @param royaltyCutBPS Total percentage of token purchases taken by royalty split on CreatorBlueprint deployed instance
     * @param split Pre-existing royalty splits contract
     */
    function deployAndPrepareCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        CreatorBlueprints.BlueprintPreparationConfig calldata blueprintPreparationConfig,
        uint32 royaltyCutBPS,
        address split
    ) external {
        address blueprintContract = _deployCreatorBlueprints(
            creatorBlueprintsInput,
            royaltyCutBPS,
            split,
            address(this)
        );

        CreatorBlueprints(blueprintContract).prepareBlueprint(blueprintPreparationConfig);

        // renounce role as minter
        IAccessControlUpgradeable(blueprintContract).renounceRole(keccak256("MINTER_ROLE"), address(this));
    }

    /**
     * @dev Deploy CreatorBlueprints, deploy associated royalty splitter contract, and prepare blueprint
     * @param creatorBlueprintsInput Object containing core CreatorBlueprints configuration 
     * @param blueprintPreparationConfig Object containing all values needed to prepare blueprint
     * @param royaltyRecipients Array of royalty recipients to encode into immutable royalty split
     * @param allocations Array of allocations by percentage, given to members in royaltyRecipients 
     * @param royaltyCutBPS Total percentage of token purchases taken by royalty split on CreatorBlueprint deployed instance
     */
    function deployRoyaltySplitterAndPrepareCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        CreatorBlueprints.BlueprintPreparationConfig calldata blueprintPreparationConfig,
        address[] calldata royaltyRecipients, 
        uint32[] calldata allocations,
        uint32 royaltyCutBPS
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
            address(this)
        );

        CreatorBlueprints(blueprintContract).prepareBlueprint(blueprintPreparationConfig);

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
     */
    function _deployCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput, 
        uint32 royaltyCutBPS,
        address split,
        address extraMinter
    ) private returns (address) {
        CreatorBlueprints.RoyaltyParameters memory royaltyParameters = CreatorBlueprints.RoyaltyParameters(split, royaltyCutBPS);
        CreatorBlueprints.CreatorBlueprintsAdmins memory blueprintAdmins = defaultCreatorBlueprintsAdmins;
        address creatorBlueprint = address(new BeaconProxy(
            beacon,
            abi.encodeWithSelector(
                CreatorBlueprints(address(0)).initialize.selector, 
                creatorBlueprintsInput,
                blueprintAdmins,
                royaltyParameters,
                extraMinter
            )
        ));

        emit CreatorBlueprintDeployed(
            creatorBlueprint,
            split
        ); 

        return creatorBlueprint;
    }

    /**
     * @dev Owner-only function to change the default addresses given privileges on CreatorBlueprints instances 
     * @param _newDefaultCreatorBlueprintsAdmins New set of default addresses
     */
    function changeDefaultCreatorBlueprintsAdmins(
        CreatorBlueprints.CreatorBlueprintsAdmins calldata _newDefaultCreatorBlueprintsAdmins
    ) external onlyOwner {
        require(
            _newDefaultCreatorBlueprintsAdmins.platform != address(0) && 
            _newDefaultCreatorBlueprintsAdmins.asyncSaleFeesRecipient != address(0) && 
            _newDefaultCreatorBlueprintsAdmins.minter != address(0), 
            "Invalid address"
        );
        defaultCreatorBlueprintsAdmins = _newDefaultCreatorBlueprintsAdmins;
    }
}