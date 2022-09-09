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
            false
        );
    }

    function deployCreatorBlueprintsAndRoyaltySplitter(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        uint32 royaltyCutBPS
    ) external {
        address split = ISplitMain(_splitMain).createSplit(
            _defaultRoyaltiesAccounts(creatorBlueprintsInput.artist), 
            _defaultRoyaltiesPercentAllocations(), 
            0, 
            address(0)
        );

        _deployCreatorBlueprints(
            creatorBlueprintsInput, 
            royaltyCutBPS,
            split,
            false
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
            true
        );

        CreatorBlueprints(blueprintContract).prepareBlueprint(blueprintPreparationConfig);

        // give minter role to actual minter 
        CreatorBlueprints(blueprintContract).updateMinterAddress(defaultCreatorBlueprintsAdmins.minter);
    }

    function deployRoyaltySplitterAndPrepareCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput,
        CreatorBlueprints.BlueprintPreparationConfig calldata blueprintPreparationConfig,
        uint32 royaltyCutBPS
    ) external {
        address split = ISplitMain(_splitMain).createSplit(
            _defaultRoyaltiesAccounts(creatorBlueprintsInput.artist), 
            _defaultRoyaltiesPercentAllocations(), 
            0, 
            address(0)
        );

        address blueprintContract = _deployCreatorBlueprints(
            creatorBlueprintsInput, 
            royaltyCutBPS,
            split,
            true
        );

        CreatorBlueprints(blueprintContract).prepareBlueprint(blueprintPreparationConfig);

        // give minter role to actual minter 
        CreatorBlueprints(blueprintContract).updateMinterAddress(defaultCreatorBlueprintsAdmins.minter);
    }

    function predictBlueprintsRoyaltiesSplitAddress(
        address _artist
    ) external view {
        ISplitMain(_splitMain).predictImmutableSplitAddress(
            _defaultRoyaltiesAccounts(_artist), 
            _defaultRoyaltiesPercentAllocations(), 
            0
        );
    }

    function _deployCreatorBlueprints(
        CreatorBlueprints.CreatorBlueprintsInput calldata creatorBlueprintsInput, 
        uint32 royaltyCutBPS,
        address split,
        bool setTemporaryMinter // if true, set factory contract as temporary minter to prepare blueprint right after
    ) private returns (address) {
        CreatorBlueprints.RoyaltyParameters memory royaltyParameters = CreatorBlueprints.RoyaltyParameters(split, royaltyCutBPS);
        CreatorBlueprints.CreatorBlueprintsAdmins memory blueprintAdmins = defaultCreatorBlueprintsAdmins;
        if (setTemporaryMinter) {
            blueprintAdmins.minter = address(this);
        }

        address creatorBlueprint = address(new BeaconProxy(
            beacon,
            abi.encodeWithSelector(
                CreatorBlueprints(address(0)).initialize.selector, 
                creatorBlueprintsInput,
                blueprintAdmins,
                royaltyParameters
            )
        ));

        emit CreatorBlueprintDeployed(
            creatorBlueprint,
            split
        ); 

        return creatorBlueprint;
    }

    function _defaultRoyaltiesAccounts(address _artist) internal view returns(address[] memory) {
        address[] memory _recipients = new address[](2);
        _recipients[0] = defaultCreatorBlueprintsAdmins.asyncSaleFeesRecipient; 
        _recipients[1] = _artist;
        return _recipients;
    }

    function _defaultRoyaltiesPercentAllocations() internal pure returns(uint32[] memory) {
        uint32[] memory _allocations = new uint32[](2); 
        _allocations[0] = 250000; // 75%
        _allocations[1] = 750000; // 25% 
        return _allocations;
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