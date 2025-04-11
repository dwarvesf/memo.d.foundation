import React, { useEffect, useState } from 'react';
import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { Copy, InfoIcon, LogOut } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import LogoIcon from '../icons/LogoIcon';
import { formatEther } from 'viem';
import { Avatar } from '../ui/avatar';
import Jdenticon from 'react-jdenticon';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useIsMounted } from 'usehooks-ts';

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
enum FirstConnectEnum {
  notStarted,
  connecting,
  done,
}
const HeaderUser = () => {
  const isMounted = useIsMounted();
  const { address: curAddress, isConnecting, status } = useAccount();
  const [localAddress, setLocalAddress] = useState<string>('');
  const [firstConnectStatus, setFirstConnectStatus] =
    useState<FirstConnectEnum>(FirstConnectEnum.notStarted);
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address: curAddress,
  });
  const { openConnectModal } = useConnectModal();

  const address =
    firstConnectStatus === FirstConnectEnum.done
      ? curAddress
      : curAddress || localAddress;

  useEffect(() => {
    const localAddress = localStorage.getItem('loggedInAddress');
    if (localAddress?.startsWith('0x')) {
      setLocalAddress(localAddress);
    }
  }, []);

  useEffect(() => {
    if (['reconnecting', 'connecting'].includes(status)) {
      setFirstConnectStatus(FirstConnectEnum.connecting);
      return;
    }
    if (status === 'connected') {
      setFirstConnectStatus(FirstConnectEnum.done);
      return;
    }
    if (status === 'disconnected') {
      setFirstConnectStatus(prev => {
        if (prev === FirstConnectEnum.notStarted) {
          return prev;
        }
        return FirstConnectEnum.done;
      });
      return;
    }
  }, [status]);

  const formattedBalance = React.useMemo(() => {
    if (!balance) return '0';
    return formatBalance(balance.value);
  }, [balance]);

  if (!isMounted()) {
    return <div className="h-9 w-9"></div>;
  }
  if (!address) {
    return (
      <Button disabled={isConnecting} onClick={openConnectModal}>
        Connect
      </Button>
    );
  }

  const handleDisconnect = () => {
    disconnect();
    localStorage.removeItem('loggedInAddress');
  };
  return (
    <Popover>
      <PopoverTrigger className="cursor-pointer">
        <div className="p-0.5">
          <Avatar className="dark:bg-secondary flex h-8 w-8 items-center justify-center border bg-[#fff]">
            <Jdenticon value={address || ''} size={30} />
          </Avatar>
        </div>
      </PopoverTrigger>

      <PopoverContent className="mr-5 w-68 max-w-sm rounded-lg p-0">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Avatar className="dark:bg-secondary flex h-10 w-10 items-center justify-center border bg-[#fff]">
            <Jdenticon value={address || ''} size={38} />
          </Avatar>
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
            onClick={handleDisconnect}
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
