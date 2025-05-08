import { cn, uppercaseSpecialWords } from '@/lib/utils';
import { IMetadata } from '@/types';
import React from 'react';
import { formatDate } from 'date-fns';
import CalendarIcon from '../icons/CalendarIcon';
import CircleUserIcon from '../icons/CircleUserIcon';
import FolderIcon from '../icons/FolderIcon';
import Link from 'next/link';
import {
  NFT_CONTRACT_ADDRESS_TESTNET,
  NFT_CONTRACT_ADDRESS,
  NFT_CONTRACT_ABI,
} from '@/constants/nft';
import { baseSepolia } from 'viem/chains';
import { useChainId, useReadContract } from 'wagmi';
import PartnerExchangeIcon from '../icons/PartnerExchangeIcon';
import TagsIcon from '../icons/TagsIcon';

interface Props {
  metadata?: IMetadata;
}

const RightSidebar = (props: Props) => {
  const { metadata } = props;
  const { tokenId } = metadata || {};
  const chainId = useChainId();

  const contractAddress =
    chainId === baseSepolia.id
      ? NFT_CONTRACT_ADDRESS_TESTNET
      : NFT_CONTRACT_ADDRESS;

  const { data: mintCount } = useReadContract({
    address: contractAddress,
    abi: NFT_CONTRACT_ABI,
    functionName: 'getMintCountByTokenId',
    args: tokenId ? [BigInt(tokenId)] : undefined,
  });

  const displayMintCount = mintCount ? Number(mintCount) : 0;

  return (
    <div
      className={cn(
        'right-sidebar leading-[140% xl:w-right-sidebar-width hidden w-[200px] font-sans text-sm font-medium xl:flex',
        'transition-[transform,opacity,visibility] duration-100 ease-in-out',
        'visible w-0 translate-x-0 transform opacity-100',
        'reading:opacity-0 reading:xl:translate-x-[10px] reading:invisible reading:fixed reading:right-[calc((100vw-var(--container-max-width)-var(--nav-sidebar-width))/2-var(--right-sidebar-width)-var(--column-gap))]',
      )}
    >
      <div className="right-0 flex w-full flex-col gap-y-8 pt-4 pb-10 transition-[top] duration-200 ease-in-out">
        {metadata && (
          <div className="metadata space-y-6">
            <div className="">
              <h3 className="text-black-secondary dark:text-foreground text-2xs mb-3 font-sans font-semibold tracking-[0.8px] uppercase">
                Properties
              </h3>
              <ul className="space-y-2 text-sm">
                {metadata.created && (
                  <li className="text-secondary-foreground dark:text-secondary-light flex flex-wrap items-center gap-1 text-xs leading-4 -tracking-[0.125px]">
                    <CalendarIcon className="h-4 w-4" />
                    <span>Created:</span>
                    <span>{formatDate(metadata.created, 'MMM dd, yyyy')}</span>
                  </li>
                )}

                {metadata.updated && metadata.updated !== metadata.created && (
                  <li className="text-secondary-foreground dark:text-secondary-light flex flex-wrap items-center gap-1 text-xs leading-4 -tracking-[0.125px]">
                    <CalendarIcon className="h-4 w-4" />
                    <span>Updated:</span>
                    <span>{metadata.updated}</span>
                  </li>
                )}

                {metadata.author && (
                  <li className="text-secondary-foreground dark:text-secondary-light flex flex-wrap items-center gap-1 text-xs leading-4 -tracking-[0.125px]">
                    <CircleUserIcon width={16} height={16} />
                    <span>Author:</span>
                    <Link
                      href={`/contributor/${metadata.author}`}
                      className="hover:text-primary hover:underline"
                    >
                      {metadata.author}
                    </Link>
                  </li>
                )}
                {metadata.coAuthors && metadata.coAuthors.length > 0 && (
                  <li className="text-secondary-foreground dark:text-secondary-light flex flex-wrap gap-1 text-xs leading-4 -tracking-[0.125px]">
                    <CircleUserIcon width={16} height={16} />
                    <span className="text-secondary-foreground dark:text-secondary-light shrink-0">
                      Co-author:
                    </span>
                    {metadata.coAuthors.map((author, index) => (
                      <Link
                        key={author}
                        href={`/contributor/${author}`}
                        className="hover:text-primary hover:underline"
                      >
                        {author}
                        {index < metadata.coAuthors!.length - 1 ? ', ' : ''}
                      </Link>
                    ))}
                  </li>
                )}
                {!!tokenId && (
                  <li className="text-secondary-foreground dark:text-secondary-light flex flex-wrap items-center gap-1 text-xs leading-4 -tracking-[0.125px]">
                    <PartnerExchangeIcon className="h-4 w-4" />
                    <span>Minted:</span>
                    <span>{displayMintCount} collectors</span>
                  </li>
                )}

                {metadata.tags && metadata.tags.length > 0 && (
                  <li className="text-secondary-foreground dark:text-secondary-light flex flex-wrap items-center gap-1 text-xs leading-4 -tracking-[0.125px]">
                    <TagsIcon width={16} height={16} />
                    <span>Tags:</span>{' '}
                    {metadata.tags.slice(0, 3).map((tag, index) => (
                      <Link
                        key={index}
                        href={`/tags/${tag.toLowerCase().replace(/\s+/g, '-')}`}
                        className="bg-muted hover:bg-muted/80 hover:text-primary dark:bg-border dark:text-foreground dark:hover:text-primary inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[#4b4f53]"
                      >
                        {uppercaseSpecialWords(tag)}
                      </Link>
                    ))}
                  </li>
                )}
              </ul>
            </div>

            {metadata.folder && (
              <div className="">
                <h3 className="text-black-secondary dark:text-foreground text-2xs mb-3 font-sans font-semibold tracking-[0.8px] uppercase">
                  Location
                </h3>
                <ul className="space-y-2 text-sm">
                  <li className="text-secondary-foreground dark:text-secondary-light vertical-center inline text-xs leading-4 -tracking-[0.125px]">
                    <FolderIcon
                      width={16}
                      height={16}
                      className="mr-1 mb-0.5 inline-block"
                    />
                    <span>Folder:</span>{' '}
                    <Link
                      href={`/${metadata.folder}`}
                      className="hover:text-primary inline break-all hover:underline"
                    >
                      {metadata.folder}
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            {(metadata.wordCount ||
              metadata.characterCount ||
              metadata.blocksCount ||
              metadata.readingTime) && (
              <div className="">
                <h3 className="text-black-secondary dark:text-foreground text-2xs mb-3 font-sans font-semibold tracking-[0.8px] uppercase">
                  Stats
                </h3>
                <ul className="space-y-2 text-sm">
                  {!!metadata.wordCount && (
                    <li className="text-secondary-foreground dark:text-secondary-light flex items-center justify-between gap-1 text-xs leading-4 -tracking-[0.125px]">
                      <span>Words:</span>
                      <span>{metadata.wordCount.toLocaleString()}</span>
                    </li>
                  )}

                  {!!metadata.characterCount && (
                    <li className="text-secondary-foreground dark:text-secondary-light flex items-center justify-between gap-1 text-xs leading-4 -tracking-[0.125px]">
                      <span>Characters:</span>
                      <span>{metadata.characterCount.toLocaleString()}</span>
                    </li>
                  )}

                  {!!metadata.blocksCount && (
                    <li className="text-secondary-foreground dark:text-secondary-light flex items-center justify-between gap-1 text-xs leading-4 -tracking-[0.125px]">
                      <span>Blocks:</span>
                      <span>{metadata.blocksCount.toLocaleString()}</span>
                    </li>
                  )}

                  {!!metadata.readingTime && (
                    <li className="text-secondary-foreground dark:text-secondary-light flex items-center justify-between gap-1 text-xs leading-4 -tracking-[0.125px]">
                      <span>Reading time:</span>
                      <span>{metadata.readingTime}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RightSidebar;
