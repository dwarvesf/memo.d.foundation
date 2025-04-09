/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { IMetadata } from '@/types';
import Jdenticon from 'react-jdenticon';
import { ethers } from 'ethers';
import { useWallet, WalletInfo } from '@/contexts/WalletContext';
import { BrowserProvider } from 'ethers';
import {
  NFT_CONTRACT_ADDRESS,
  NFT_CONTRACT_ABI,
  MINT_AMOUNT,
  FALLBACK_IMAGE_ID,
  ACTIVE_CHAIN,
} from '@/constants/nft';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Props {
  metadata: IMetadata;
}

interface NFTMetadata {
  name: string;
  authors: string[];
  image: string;
}

const formattedAddress = `${NFT_CONTRACT_ADDRESS.substring(
  0,
  10,
)}...${NFT_CONTRACT_ADDRESS.substring(NFT_CONTRACT_ADDRESS.length - 6)}`;
const explorerUrl =
  ACTIVE_CHAIN.blockExplorerUrls[0] + '/address/' + NFT_CONTRACT_ADDRESS;

const MintEntry: React.FC<Props> = ({ metadata }) => {
  const { tokenId, permaStorageId, title, author, authorRole, image } =
    metadata || {};
  const {
    isConnected,
    account,
    currentWallet,
    connect,
    isWrongChain,
    switchChain,
    availableWallets,
    onSelectWallet,
  } = useWallet();
  const isInitializedRef = React.useRef(false);
  const [mintCount, setMintCount] = useState<number>(0);
  const [collectors, setCollectors] = useState<string[]>([]);
  const [contentDigest, setContentDigest] = useState<string>('Calculating...');
  const [nftMetadata, setNftMetadata] = useState<NFTMetadata | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [showWallets, setShowWallets] = useState(false);

  const fetchMintInfo = useCallback(async () => {
    if (!tokenId) return;
    try {
      const response = await fetch(
        `https://memo-nft-api-prod.fly.dev/minters/${tokenId}`,
      );
      if (!response.ok) throw new Error('Failed to fetch mint info');
      const data = await response.json();
      setMintCount(data.total);
      setCollectors(data.data.map((item: any) => item.minter));
    } catch (error) {
      console.error('Error fetching mint info:', error);
    }
  }, [tokenId]);
  const connectToContract = useCallback(
    async (walletProvider: ethers.Eip1193Provider) => {
      try {
        // Create ethers provider from the wallet provider
        let provider = new BrowserProvider(walletProvider);

        // Check if we're on the correct chain
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== ACTIVE_CHAIN.chainId) {
          // Prompt to switch to the correct chain
          try {
            await walletProvider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: ACTIVE_CHAIN.chainIdHex }],
            });
          } catch (switchError: any) {
            // If the chain hasn't been added, try to add it
            if (switchError.code === -32603 || switchError.code === 4902) {
              try {
                await walletProvider.request({
                  method: 'wallet_addEthereumChain',
                  params: [ACTIVE_CHAIN],
                });

                connectToContract(walletProvider);
              } catch (error) {
                console.log(error);
              }
            } else {
              throw switchError;
            }
          }

          // Refresh provider after chain switch
          provider = new BrowserProvider(walletProvider);
        }

        // Get the signer and create contract instance
        const signer = await provider.getSigner();
        const nftContract = new ethers.Contract(
          NFT_CONTRACT_ADDRESS,
          NFT_CONTRACT_ABI,
          signer,
        );

        setContract(nftContract);
        return nftContract;
      } catch (error) {
        console.error('Failed to connect to contract:', error);
      }
    },
    [],
  );

  useEffect(() => {
    // Calculate content digest
    const calculateDigest = async () => {
      try {
        const content = JSON.stringify({
          tokenId,
          permaStorageId,
          title,
          author,
        });
        const hashBuffer = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(content),
        );
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        setContentDigest(hashHex.substring(0, 20));
      } catch (error) {
        console.error('Failed to calculate content digest:', error);
        setContentDigest('Error calculating digest');
      }
    };

    // Fetch NFT metadata from Arweave
    const fetchNFTMetadata = async () => {
      try {
        const response = await fetch(`https://arweave.net/${permaStorageId}`);
        if (!response.ok) throw new Error('Failed to fetch NFT metadata');
        const data = await response.json();
        setNftMetadata(data);
      } catch (error) {
        console.error('Error fetching NFT metadata:', error);
      }
    };

    const initializeContract = async () => {
      if (currentWallet?.provider) {
        try {
          const nftContract = await connectToContract(currentWallet.provider);
          if (!nftContract) {
            console.error('NFT contract not initialized');
            return;
          }

          if (!tokenId || !account) {
            console.error('Token ID or account not available');
            return;
          }

          // Convert tokenId to BigInt and ensure proper parameter order
          const tokenIdBigInt = BigInt(tokenId);
          console.log('Checking balance for:', {
            id: tokenIdBigInt.toString(),
            account,
          });

          try {
            // First check if the contract has the getMintCountByTokenId method
            const mintCount =
              await nftContract.getMintCountByTokenId(tokenIdBigInt);
            console.log('Total mint count:', Number(mintCount));

            // Then check user's balance with correct parameter order
            const balance = await nftContract.balanceOf(
              account, // address
              tokenIdBigInt, // uint256 id
            );

            console.log('User balance:', Number(balance));
            setIsMinted(Number(balance) > 0);
            isInitializedRef.current = true;
          } catch (error) {
            console.error('Error checking balance:', error);
            // Log the full error for debugging
            if (error instanceof Error) {
              console.error({
                message: error.message,
                name: error.name,
                stack: error.stack,
              });
            }
          }
        } catch (error) {
          console.error('Error in contract initialization:', error);
          if (error instanceof Error) {
            console.error('Error details:', error.message);
          }
        }
      }
    };
    if (isInitializedRef.current) {
      return;
    }
    calculateDigest();
    fetchNFTMetadata();
    fetchMintInfo();
    initializeContract();
  }, [
    tokenId,
    permaStorageId,
    title,
    author,
    currentWallet,
    isConnected,
    isWrongChain,
    account,
    fetchMintInfo,
  ]);

  const handleMint = async () => {
    if (!isConnected) {
      setShowWallets(true);
      return;
    }

    if (!tokenId) {
      console.error('Cannot mint: Token ID is not available');
      return;
    }

    console.log('Wallet connected, proceeding with mint');

    if (!isConnected) {
      // Trigger wallet connection if not connected
      const provider = Array.from(availableWallets.values())[0]?.provider;
      if (provider) {
        await connect(provider);
      }
      return;
    }

    if (isWrongChain) {
      await switchChain();
      return;
    }

    if (!contract || !tokenId) {
      console.error('Contract or tokenId not available');
      return;
    }

    setIsMinting(true);
    try {
      const tx = await contract.mintNFT(tokenId, MINT_AMOUNT);
      await tx.wait();

      // Update collectors and mint count
      await fetchMintInfo();
      setIsMinted(true);
    } catch (error) {
      console.error('Minting failed:', { error });
    } finally {
      setIsMinting(false);
    }
  };

  const handleWalletSelect = async (wallet: WalletInfo) => {
    setShowWallets(false);
    onSelectWallet(wallet);
  };

  const getMintButtonText = () => {
    if (isMinting) return 'Minting...';
    if (isMinted) return 'Minted';
    if (isWrongChain) return 'Switch Network';
    if (!isConnected) return 'Connect Wallet to Mint';
    return 'Mint';
  };
  const mintedImage = useMemo(() => {
    if (nftMetadata?.image) {
      const imageId = nftMetadata.image.replace('ar://', '');
      return `https://arweave.net/${imageId}`;
    } else {
      return `https://arweave.net/${FALLBACK_IMAGE_ID}`;
    }
  }, [nftMetadata]);

  return (
    <div className="mb-4 grid gap-6 md:grid-cols-2">
      {/* Minting Section */}
      <Card className="dark:bg-muted/90 rounded-lg bg-[#f8f0f0] p-6 shadow-xs">
        <div className="flex flex-col gap-6">
          {/* NFT Preview */}
          <div className="dark:border-border dark:bg-secondary mx-auto flex h-[192px] w-[192px] flex-col overflow-hidden rounded border bg-[#fff]">
            <div className="relative">
              <img
                src={
                  mintedImage ||
                  image ||
                  metadata.firstImage ||
                  '/assets/img/LOGO.png'
                }
                alt={title}
                className="no-zoom h-full w-full rounded-none object-cover"
              />
            </div>
            <p className="text-2xs mt-auto px-3 py-2 font-medium">
              {nftMetadata?.name || title}
            </p>
            <div className="dark:border-border flex items-center gap-2 border-t px-3 py-2">
              <Avatar className="h-4 w-4">
                <Jdenticon value={author} size={16} />
              </Avatar>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-2xs">{author}</span>
                {authorRole && (
                  <span className="text-muted-foreground/70 text-2xs">
                    {authorRole}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-muted-foreground text-center text-sm">
            Mint this entry as an NFT to add it to your collection.
          </p>

          <Popover
            open={showWallets && !isConnected}
            onOpenChange={setShowWallets}
          >
            <PopoverTrigger asChild>
              <Button
                className={cn(
                  'mint-button',
                  isMinted && 'cursor-not-allowed opacity-50',
                )}
                onClick={handleMint}
                disabled={isMinting || isMinted}
              >
                {getMintButtonText()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="center">
              <div className="space-y-2">
                <p className="text-sm font-medium">Connect Wallet</p>
                <div className="flex flex-col gap-2">
                  {Array.from(availableWallets.entries()).map(
                    ([rdns, wallet]) => (
                      <Button
                        key={rdns}
                        variant="outline"
                        className="flex items-center justify-start gap-2"
                        onClick={() => handleWalletSelect(wallet)}
                      >
                        <Image
                          src={wallet.icon}
                          alt={wallet.name}
                          width={20}
                          height={20}
                          className="rounded"
                        />
                        <span>{wallet.name}</span>
                      </Button>
                    ),
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Mint Progress */}
          <div className="flex justify-center">
            {mintCount > 0 ? (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {collectors.slice(0, 3).map(collector => (
                    <Avatar
                      key={collector}
                      className="dark:bg-secondary h-6.5 w-6.5 border-2 bg-[#fff]"
                    >
                      <Jdenticon value={collector} size={24} />
                    </Avatar>
                  ))}
                  <span className="text-primary z-1 rounded-full border border-[#fcced7] bg-[#fce7eb] px-2 text-sm leading-[26px]">
                    {mintCount} collected
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">
                Be the first to collect
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Verification Section */}
      <Card className="dark:bg-muted/90 bg-background-secondary rounded-lg p-6 shadow-xs">
        <div className="text-foreground flex flex-col gap-6">
          <h3 className="text-sm font-medium">Verification</h3>
          <p className="text-muted-foreground text-sm">
            This entry has been permanently stored onchain and signed by its
            creator.
          </p>

          <dl className="space-y-4">
            <div>
              <dt className="text-muted-foreground text-2xs leading-[140%] uppercase">
                transaction
              </dt>
              <dd className="mt-1 font-mono text-[13px] leading-[100%]">
                <Link
                  href={`https://viewblock.io/arweave/tx/${permaStorageId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary hover:decoration-primary underline decoration-neutral-100"
                >
                  {permaStorageId.substring(0, 20)}
                </Link>
              </dd>
            </div>

            <div>
              <dt className="text-muted-foreground text-2xs leading-[140%] uppercase">
                nft address
              </dt>
              <dd className="mint-entry-nft-address mt-1 font-mono text-[13px] leading-[100%]">
                <Link
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary hover:decoration-primary underline decoration-neutral-100"
                >
                  {formattedAddress}
                </Link>
              </dd>
            </div>

            <div>
              <dt className="text-muted-foreground text-2xs leading-[140%] uppercase">
                content digest
              </dt>
              <dd className="mt-1 font-mono text-[13px] leading-[100%]">
                {contentDigest}
              </dd>
            </div>
          </dl>

          <Image
            src="/assets/img/neko-sticker.svg"
            alt="Neko"
            width={32}
            height={32}
            className="no-zoom absolute -right-2 -bottom-2 rotate-[14deg]"
          />
        </div>
      </Card>
    </div>
  );
};

export default MintEntry;
