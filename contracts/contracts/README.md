# CreatorBlueprints

`CreatorBlueprints` is a creator-deployed Blueprints contract supporting one Blueprint. 

### Setting royalties

Royalties on each Blueprints are handled by it's corresponding royalty split address and total royalty cut. The total royalty cut defines the amount of the token sale that is sent to the splits contract. The holder of the `MINTER_ROLE` can modify both the recipient address and total royalty cut via `changeRoyaltyParameters`. To modify the actual split itself, do so directly on `SplitMain` (https://docs.0xsplits.xyz/smartcontracts/overview#addresses).