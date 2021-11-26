# Async Blueprints

Smart contracts to create Blueprints (series of NFTs) for the async platform

[![Tests pass](https://github.com/avolabs-io/async-blueprint/actions/workflows/main.yml/badge.svg)](https://github.com/avolabs-io/nft-auction/actions/workflows/main.yml)

This repository contains the smart contracts source code for the Async Blueprints Protocol. The repository uses Hardhat as development enviroment for compilation, testing and deployment tasks.

## What are Async Blueprints?

This smart contract allows for the creation of non-fungible tokens (NFTS) using the ERC721 standard. A blueprint is then a series of NFT artworks that are static images generated from provably random layers.

An artist can create a blueprint of a series of pieces and sell them using this smart contract. Fans of the artist can then purchase a provably random artwork related to the blueprint.

## Preparing a Blueprint

A blueprint must be prepared before sales can begin. The preparation of a Blueprint is restricted only to the Async platform and can be configured by specifying the following:

- The blueprint artist: the creator of the artwork and a recipient of fees.
- The capacity of artworks associated with the blueprint.
- The price per blueprint artwork.
- An ERC20 token address if the payment must be made in a token that is not Eth (if the payment should be an Eth amount, then this address must be the 0 address).
- Random Seed Signature Hash
- Base Token URI
- Fee Recipients: an array of alternative fee recipients can be specified. If not then fee recipients are defaulted to the Async fee recipient.
- Fee BPS that align with the above fee recipients. Must match the number of entries in the provided fee recipients.
- A Merkleroot can be provided that allows for whitelisted addresses to make a purchase prior to the sale commencing.
- A presale amount of artwork that the artist can mint. This number can be set to allow the artist to mint artwork in the blueprint for free prior to the sale commencing.
- A presale amount of artwork that the platform can mint. This number can be set to allow the platform to mint artwork in the blueprint for free prior to the sale commencing.

## Admin functions

The admin of the Blueprint contract can perform the following tasks:

### Begin Sale

If a blueprint has been prepared, the admin can begin the sale and allow users to purchase the blueprint artwork.

### Pause and unpause sale

If a sale has started, the admin can pause the sale and stop users from purchasing blueprint artwork. The sale can also be unpaused to allow purchasing to resume.

### Update the base token URI of a prepared blueprint

If a blueprint has been prepared, the admin can update the base token URI for that blueprint.

### Reveal the blueprint seed

The platform can reveal the seed of a prepared blueprint. This function will emit an event with the blueprint ID and corresponding seed.

### Set the default Async Fee recipient

The default fee recipient can be set to recieve a percentage of all sales. The percentage is initially set to 5% but can be updated in basis points of 10000.

### The platform address can be updated

The platform address can be updated. This address is assigned the admin role and is able to perform all of the above functions.

## Purchasing an Artwork

Once the platform has started the sale, any user can purchase blueprint artwork as long as they meet the price.
The purchaser can purchase multiple artworks at once, but they must match the exact price in Eth or ERC20 token specified for that blueprint.

If a user is on the whitelist for a blueprint, the blueprint sale does not need to be started for them to purchase the artwork. However a Merkle proof must be provided that matches the artists address and the quantity of artworks they are whitelisted for.

## Presale minting

The platform or the blueprint artist are able to mint blueprint artworks for free prior to the sale starting. When the blueprint is prepared an amount can be allocated to the platform and the artist that they are allowed to mint presale.

## Development

First clone this repository and enter the directory.

Install dependencies:

```
$ yarn
```

## Testing

We use [Hardhat](https://hardhat.dev) and [hardhat-deploy](https://github.com/wighawag/hardhat-deploy)

To run integration tests:

```sh
$ yarn test
```

To run coverage:

```sh
$ yarn coverage
```

To deploy to Rinkeby:
create a secretManager.js containing the required private keys(see secretsManager.example.js) then run:

```sh
$ yarn deploy-rinkeby
```

To verify the contract on rinkeby

```sh
yarn verify <implementation_address>
```

Latest deployment is available at address: 0xbd3008b9383a5d5639f7e1c34e2eb6e6a13bd0f9
https://rinkeby.etherscan.io/address/0xbd3008b9383a5d5639f7e1c34e2eb6e6a13bd0f9#code
✨

```

```
