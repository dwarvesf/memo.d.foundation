import React from 'react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { PopoverProps } from '@radix-ui/react-popover';
import Image from 'next/image';
import { WalletInfo } from '@/contexts/WalletContext';

interface Props extends PopoverProps {
  availableWallets: Map<string, WalletInfo>;
  onSelectWallet: (wallet: WalletInfo) => void;
}

const SelectWalletPopover = (props: Props) => {
  const { availableWallets, onSelectWallet, children, ...rest } = props;
  return (
    <Popover {...rest}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64" align="center">
        <div className="space-y-2">
          <p className="text-sm font-medium">Connect Wallet</p>
          <div className="flex flex-col gap-2">
            {Array.from(availableWallets.entries()).map(([rdns, wallet]) => (
              <Button
                key={rdns}
                variant="outline"
                className="flex items-center justify-start gap-2"
                onClick={() => onSelectWallet(wallet)}
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
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SelectWalletPopover;
