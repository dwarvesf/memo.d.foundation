// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Minimal stand-in for the real mint contract's `createTokenType` /
// `getTokenId` / `TokenTypeCreated` surface (see src/constants/nft.ts and
// scripts/add-mint-post.ts for the real ABI shape). Used only to exercise
// the viem transaction-construction path against a local anvil chain in
// test/add-mint-post.test.ts; never deployed anywhere real.
contract MockMintContract {
  mapping(string => uint256) private tokenIds;
  uint256 private nextTokenId = 1;

  event TokenTypeCreated(uint256 indexed tokenId, string arweaveTxId);

  function createTokenType(string memory arweaveTxId) external returns (uint256) {
    require(tokenIds[arweaveTxId] == 0, 'already exists');
    uint256 tokenId = nextTokenId;
    nextTokenId += 1;
    tokenIds[arweaveTxId] = tokenId;
    emit TokenTypeCreated(tokenId, arweaveTxId);
    return tokenId;
  }

  function getTokenId(string memory arweaveTxId) external view returns (uint256) {
    return tokenIds[arweaveTxId];
  }
}
