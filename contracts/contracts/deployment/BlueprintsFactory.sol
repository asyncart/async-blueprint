//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "../CreatorBlueprints.sol"; 
import "../BlueprintV12.sol"; 
import "../royalties/interfaces/ISplitMain.sol";

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol"; 
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol"; 
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract BlueprintsFactory is Ownable { 
    event FactoryDeployed(
        address creatorBlueprintsImplementation, 
        address beacon,
        address blueprintV12Implementation,
        address globalBlueprints
    );

    event CreatorBlueprintDeployed(
        address creatorBlueprint,
        address royaltySplit
    );

    address public immutable beacon; 

    address private immutable _splitMain;

    CreatorBlueprints.CreatorBlueprintsAdmins public defaultCreatorBlueprintsAdmins;

    constructor(
        address beaconUpgrader, 
        address globalBlueprintsUpgraderAdmin,
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
            globalBlueprintsUpgraderAdmin,
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

    function deployCreatorBlueprintsAndRoyaltySplitter(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        uint32 royaltyCutBPS
    ) external {
        (address[] memory recipients, uint32[] memory allocations) = _defaultRoyalties(creatorBlueprintsInput.artist);
        address split = ISplitMain(_splitMain).createSplit(
            recipients, 
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

    function deployRoyaltySplitterAndPrepareCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        CreatorBlueprints.BlueprintPreparationConfig calldata blueprintPreparationConfig,
        uint32 royaltyCutBPS
    ) external {
        (address[] memory recipients, uint32[] memory allocations) = _defaultRoyalties(creatorBlueprintsInput.artist);
        address split = ISplitMain(_splitMain).createSplit(
            recipients, 
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

    function predictBlueprintsRoyaltiesSplitAddress(
        address _artist
    ) external view returns(address) {
        (address[] memory recipients, uint32[] memory allocations) = _defaultRoyalties(_artist);
        return ISplitMain(_splitMain).predictImmutableSplitAddress(
            recipients, 
            allocations, 
            0
        );
    }

    function _deployCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput, 
        uint32 royaltyCutBPS,
        address split,
        address extraMinter // if true, set factory contract as temporary minter to prepare blueprint right after
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

    function _defaultRoyalties(address _artist) internal view returns(address[] memory, uint32[] memory) {
        address[] memory _recipients = new address[](2);
        uint32[] memory _allocations = new uint32[](2); 
        address asyncSaleFeesRecipient = defaultCreatorBlueprintsAdmins.asyncSaleFeesRecipient; // cache 

        // avoiding AccountsOutOfOrder error 
        if (_artist < asyncSaleFeesRecipient) {
            _recipients[0] = _artist;
            _recipients[1] = asyncSaleFeesRecipient;

            _allocations[0] = 750000; // 75%
            _allocations[1] = 250000; // 25% 
        } else {
            _recipients[0] = asyncSaleFeesRecipient;
            _recipients[1] = _artist;

            _allocations[0] = 250000; // 75%
            _allocations[1] = 750000; // 25% 
        }

        return (_recipients, _allocations);
    }

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