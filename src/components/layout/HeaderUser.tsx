import React from 'react';
import { Avatar, ConnectKitButton } from 'connectkit';
import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { Copy, InfoIcon, LogOut } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import LogoIcon from '../icons/LogoIcon';
import { formatEther } from 'viem';

const formatAddress = (address: string) => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

const formatBalance = (value: bigint): string => {
  const formatted = formatEther(value);
  const [whole, decimal] = formatted.split('.');
  if (!decimal) return whole;

  // Keep 4 decimal places and remove trailing zeros
  const truncated = decimal.slice(0, 4).replace(/0+$/, '');
  return truncated ? `${whole}.${truncated}` : whole;
};

const HeaderUser = () => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address: address,
  });

  // Format balance to max 4 decimal places
  const formattedBalance = React.useMemo(() => {
    if (!balance) return '0';
    return formatBalance(balance.value);
  }, [balance]);

  if (!isConnected) {
    return (
      <ConnectKitButton.Custom>
        {({ show, isConnecting }) => (
          <Button disabled={isConnecting} onClick={show}>
            Connect
          </Button>
        )}
      </ConnectKitButton.Custom>
    );
  }

  return (
    <Popover>
      <PopoverTrigger className="cursor-pointer">
        <div className="p-0.5">
          <Avatar address={address} size={32} />
        </div>
      </PopoverTrigger>

      <PopoverContent className="mr-5 w-68 max-w-sm rounded-lg p-0">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Avatar address={address} size={40} />
          <div className="flex-1">
            <div className="flex items-center justify-between space-x-2">
              <span className="font-sans text-sm leading-5 font-semibold">
                {formatAddress(address || '')}
              </span>
              <button
                className="cursor-pointer text-gray-500 hover:text-gray-700"
                onClick={() => {
                  copyToClipboard(address || '');
                  toast.success('Copied to clipboard', {
                    duration: 2000,
                  });
                }}
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2 p-2 px-3">
          <div className="outline-primary bg-primary/10 flex items-center gap-3 rounded p-2 outline-1 outline-offset-[-1px]">
            <div className="flex items-center gap-1 rounded-full bg-[#fdf1f9] py-0.5 pr-2 pl-1.5 outline-1 outline-offset-[-1px] outline-[#fbceee]">
              <LogoIcon className="h-[12px] w-[11px]" />
              <div className="text-primary justify-start font-sans text-xs leading-4 font-normal">
                Balance
              </div>
            </div>
            <div className="text-primary flex-1 justify-center font-sans text-sm leading-6 font-medium">
              {formattedBalance} {balance?.symbol || 'ETH'}
            </div>
            <InfoIcon className="text-primary" size={16} />
          </div>
          <button
            onClick={() => disconnect()}
            className="hover:bg-background-secondary flex w-full cursor-pointer items-center gap-3 rounded-md p-2 font-sans text-sm leading-6 font-medium -tracking-[0.14px]"
          >
            <LogOut size={20} className="text-gray-600" />
            <span>Disconnect</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default HeaderUser;
