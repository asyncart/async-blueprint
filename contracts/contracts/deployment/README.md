# Usage

`BlueprintsFactory` is used to setup the smart contracts a creator needs to distribute Blueprints NFTs, and collect royalties from them. There are currently two configurations on the factory. 
1. Deploy creator blueprints contract, and deploy a `0xSplits` (https://www.0xsplits.xyz/) compliant royalty splitter contract. 
2. Deploy creator blueprints contract, pass in pre-existing royalty split address. 

### 0xSplits Usage 
`0xSplits` uses the Create2 opcode to deterministically deploy a royalty split contract depending on these three inputs:
1. `address[] calldata accounts`
2. `uint32[] calldata percentAllocations`
3. `uint32 distributorFee` 

### Contract address clashing 
`BlueprintsFactory` takes the first two as arguments, and automatically sets the `distributorFee` to 0 when deploying a royalty split contract
prior to deploying the associated creator Blueprints contract. Since the royalty split address is deterministic, once a split is deployed with 
a set of inputs on a network, one cannot deploy another split with the same arguments on the same network, as the contract addresses would clash. 
An alternative solution is to slightly modify the `0xSplits` `SplitMain` contract to take in a nonce on split creation that Async can modulate to ensure this never happens.
An example can be found here: https://github.com/highlightxyz/hl-contracts/blob/main/contracts/royalties/SplitMain.sol. This would require a separate instance of `SplitMain` deployed.
We've avoided this solution for now. 

2 solutions are proposed for situations requiring a split with the same inputs as a previous split. 
1. If a royalty split address exists for a set of inputs already, simply use the alternative deploy function on the factory, `deployCreatorBlueprints`, passing in the existing split address. 
2. If the above solution doesn't work (if we require a completely separate contract initially for the split), create a split on the `SplitMain` contract directly, passing in a random distributor fee, and then change the distributor fee back to 0 in a subsequent transaction. 

### Opensea royalty interoperabilty 

Async should use `predictBlueprintsRoyaltiesSplitAddress` to predict the split address prior to deploying a creator's blueprints contract. This serves well to identify clashes as per the above section. More importantly, it can be used to populate contract-level metadata for the creator blueprints contract. Opensea automatically configures royalty recipients for a collection if they are specified in contract-level metadata, exposed through the function `contractURI` (https://docs.opensea.io/docs/contract-level-metadata). Since this string is passed in on deployment, it is important that Async knows the expected split address before deployment. 

### System smart contracts 

When the factory is deployed, it also deploys the `CreatorBlueprints` implementation, it's beacon, the global `BlueprintsV12` implementation, and it's proxy. These 4 smart contracts encapsulate Async's Blueprints ecosystem, meaning only the factory deployment is required to get started. 