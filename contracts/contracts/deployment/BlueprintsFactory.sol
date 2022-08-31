//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

import "../CreatorBlueprints.sol"; 
import "../BlueprintV12.sol"; 

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol"; 
import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol"; 
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract BlueprintsFactory { 
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

    constructor(
        address beaconUpgrader, 
        address globalBlueprintsUpgraderAdmin,
        string memory globalBlueprintsName,
        string memory globalBlueprintsSymbol,
        address globalBlueprintsMinter,
        address _platform 
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
                msg.sender                
            )
        ));

        emit FactoryDeployed(
            creatorBlueprintsImplementation, 
            _beacon,
            blueprintV12Implementation,
            proxy            
        );
    }

    function deployCreatorBlueprints(
        address split,
        string memory name_,
        string memory symbol_,
        address minter,
        address _platform
    ) external {
        _deployCreatorBlueprints(
            split,
            name_,
            symbol_,
            minter,
            _platform
        );
    }

    function deployCreatorBlueprintsAndRoyaltySplitter(
        string memory name_,
        string memory symbol_,
        address minter,
        address _platform
    ) external {
        address split = address(0); // TODO: Deploy royalty splitter contract, placeholder for now

        _deployCreatorBlueprints(
            split, 
            name_,
            symbol_,
            minter,
            _platform
        );
    }

    function _deployCreatorBlueprints(
        address split,
        string memory name_,
        string memory symbol_,
        address minter,
        address _platform
    ) private {
        // TODO: Create parameter for royalty split in CreatorBlueprints.initialize, pass in split

        address creatorBlueprint = address(new BeaconProxy(
            beacon,
            abi.encodeWithSelector(
                CreatorBlueprints(address(0)).initialize.selector, 
                name_,
                symbol_,
                minter,
                _platform
            )
        ));

        emit CreatorBlueprintDeployed(
            creatorBlueprint,
            split
        ); 
    }
}