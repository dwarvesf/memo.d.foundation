// Chain configuration
export const CHAIN_CONFIG = {
  testnet: {
    chainId: 84532,
    chainIdHex: '0x14A34',
    chainName: 'Base Sepolia Testnet',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://sepolia.base.org',
      'https://base-sepolia-rpc.publicnode.com',
      'https://sepolia.base.meowrpc.com',
    ],
    blockExplorerUrls: ['https://sepolia.basescan.org'],
  },
  mainnet: {
    chainId: 8453,
    chainIdHex: '0x2105',
    chainName: 'Base Mainnet',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://mainnet.base.org',
      'https://base.meowrpc.com',
      'https://base.publicnode.com',
    ],
    blockExplorerUrls: ['https://basescan.org'],
  },
} as const;

// Active chain configuration
// Change this to 'mainnet' for production
// or 'testnet' for testing
const env: keyof typeof CHAIN_CONFIG = 'testnet';
export const ACTIVE_CHAIN = CHAIN_CONFIG[env];

const DEV_NFT_CONTRACT_ADDRESS = '0xb1e052156676750D193D800D7D91eA0C7cEeAdF0';
const PROD_NFT_CONTRACT_ADDRESS = '0x07f3ed54e0b2D07cC522c4FC12EbA80E6D3A8DeB';

export const NFT_CONTRACT_ADDRESS =
  env === 'testnet' ? DEV_NFT_CONTRACT_ADDRESS : PROD_NFT_CONTRACT_ADDRESS;
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
