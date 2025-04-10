import { base, baseSepolia } from 'viem/chains';
const env = 'testnet';
// get project ID from https://cloud.reown.com/sign-in
export const WALLETCONNECT_PROJECT_ID = '677a0acc9f3db6c0af94b8695260f98f';

export const NFT_CONTRACT_ADDRESS_TESTNET =
  '0xb1e052156676750D193D800D7D91eA0C7cEeAdF0';
export const NFT_CONTRACT_ADDRESS =
  '0x07f3ed54e0b2D07cC522c4FC12EbA80E6D3A8DeB';
export const ACTIVE_CHAIN = env === 'testnet' ? baseSepolia : base;

export const MINT_AMOUNT = 1;
export const FALLBACK_IMAGE_ID = '29D_NrcYOiOLMPVROGt5v3URNxftYCDK7z1-kyNPRT0';

export const NFT_CONTRACT_ABI = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'mintNFT',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'readNFT',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
    ],
    name: 'getMintCountByTokenId',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'id',
        type: 'uint256',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'uint256',
        name: 'tokenId',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'TokenMinted',
    type: 'event',
  },
];
