import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { IMetadata } from '@/types';
import {
  NFT_CONTRACT_ADDRESS,
  MINT_AMOUNT,
  FALLBACK_IMAGE_ID,
  NFT_CONTRACT_ABI,
  ACTIVE_CHAIN,
  NFT_CONTRACT_ADDRESS_TESTNET,
} from '@/constants/nft';
import {
  useAccount,
  useWriteContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
  useReadContract,
} from 'wagmi';
import { Avatar, useModal } from 'connectkit';
import { baseSepolia } from 'viem/chains';

interface Props {
  metadata: IMetadata;
}

interface NFTMetadata {
  name: string;
  authors: string[];
  image: string;
}

const MintEntry: React.FC<Props> = ({ metadata }) => {
  const { tokenId, permaStorageId, title, author, authorRole, image } =
    metadata || {};
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain, chains } = useSwitchChain();

  const { openSIWE } = useModal();

  const [collectors, setCollectors] = useState<string[]>([]);
  const [contentDigest, setContentDigest] = useState<string>('Calculating...');
  const [nftMetadata, setNftMetadata] = useState<NFTMetadata | null>(null);
  const contractAddress =
    chainId === baseSepolia.id
      ? NFT_CONTRACT_ADDRESS_TESTNET
      : NFT_CONTRACT_ADDRESS;

  const formattedAddress = useMemo(
    () =>
      `${contractAddress.substring(
        0,
        10,
      )}...${contractAddress.substring(contractAddress.length - 6)}`,
    [contractAddress],
  );

  const explorerUrl = useMemo(() => {
    const chain = chains.find(chain => chain.id === ACTIVE_CHAIN.id);
    if (chain?.blockExplorers) {
      return chain.blockExplorers.default.url + '/address/' + contractAddress;
    }
    return (
      ACTIVE_CHAIN.blockExplorers?.default.url +
      '/address/' +
      NFT_CONTRACT_ADDRESS
    );
  }, [chains, contractAddress]);

  const { data: simulateData } = useSimulateContract({
    address: contractAddress,
    abi: NFT_CONTRACT_ABI,
    functionName: 'mintNFT',
    args: tokenId ? [tokenId, MINT_AMOUNT] : undefined,
  });

  const { writeContract, data: hash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const { data: mintCount } = useReadContract({
    address: contractAddress,
    abi: NFT_CONTRACT_ABI,
    functionName: 'getMintCountByTokenId',
    args: tokenId ? [BigInt(tokenId)] : undefined,
  });

  const { data: userBalance } = useReadContract({
    address: contractAddress,
    abi: NFT_CONTRACT_ABI,
    functionName: 'balanceOf',
    args: address && tokenId ? [address, BigInt(tokenId)] : undefined,
  });

  const isMinted = useMemo(() => {
    return userBalance ? Number(userBalance) > 0 : false;
  }, [userBalance]);

  const handleMint = async () => {
    if (!tokenId) {
      console.error('Cannot mint: Token ID is not available');
      return;
    }
    if (simulateData?.request) {
      writeContract(simulateData.request);
    }
  };

  const fetchMintInfo = useCallback(async () => {
    if (!tokenId) return;
    try {
      const response = await fetch(
        `https://memo-nft-api-prod.fly.dev/minters/${tokenId}`,
      );
      if (!response.ok) throw new Error('Failed to fetch mint info');
      const data = await response.json();
      setCollectors(data.data.map((item: { minter: string }) => item.minter));
    } catch (error) {
      console.error('Error fetching mint info:', error);
    }
  }, [tokenId]);

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

    calculateDigest();
    fetchNFTMetadata();
    fetchMintInfo();
  }, [tokenId, permaStorageId, title, author, isConnected, fetchMintInfo]);

  const getMintButtonConfig = () => {
    if (isPending || isConfirming) {
      return {
        text: 'Minting...',
        disabled: true,
        onClick: undefined,
      };
    }

    if (isSuccess || isMinted) {
      return {
        text: 'Minted',
        disabled: true,
        onClick: undefined,
      };
    }

    const chainIds = chains.map(chain => chain.id);
    if (!chainIds.includes(chainId)) {
      return {
        text: 'Switch Network',
        disabled: false,
        onClick: () =>
          switchChain({
            chainId: ACTIVE_CHAIN.id,
          }),
      };
    }

    if (!isConnected) {
      return {
        text: 'Connect Wallet',
        disabled: false,
        onClick: () => openSIWE(),
      };
    }

    return {
      text: 'Mint',
      disabled: false,
      onClick: handleMint,
    };
  };

  const buttonConfig = getMintButtonConfig();

  const mintedImage = useMemo(() => {
    if (nftMetadata?.image) {
      const imageId = nftMetadata.image.replace('ar://', '');
      return `https://arweave.net/${imageId}`;
    } else {
      return `https://arweave.net/${FALLBACK_IMAGE_ID}`;
    }
  }, [nftMetadata]);

  const displayMintCount = useMemo(() => {
    return mintCount ? Number(mintCount) : 0;
  }, [mintCount]);

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
              <div className="h-4 w-4">
                <Avatar size={2} name={author} />
              </div>
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

          <Button
            className={cn(
              'mint-button font-sans',
              isSuccess && 'cursor-not-allowed opacity-50',
            )}
            onClick={buttonConfig.onClick}
            disabled={buttonConfig.disabled}
          >
            {buttonConfig.text}
          </Button>

          {/* Mint Progress */}
          <div className="flex justify-center">
            {displayMintCount > 0 ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center -space-x-2">
                  {collectors.slice(0, 3).map(collector => (
                    <div key={collector}>
                      <Avatar size={24} address={collector as `0x${string}`} />
                    </div>
                  ))}
                  <span className="text-primary z-1 rounded-full border border-[#fcced7] bg-[#fce7eb] px-2 font-sans text-sm leading-[26px]">
                    {displayMintCount} collected
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
          <h3 className="font-sans text-sm font-medium">Verification</h3>
          <p className="text-muted-foreground text-sm">
            This entry has been permanently stored onchain and signed by its
            creator.
          </p>

          <dl className="space-y-4">
            <div>
              <dt className="text-muted-foreground text-2xs font-sans leading-[140%] uppercase">
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
              <dt className="text-muted-foreground text-2xs font-sans leading-[140%] uppercase">
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
              <dt className="text-muted-foreground text-2xs font-sans leading-[140%] uppercase">
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
