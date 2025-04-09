import React, { useState } from 'react';
import { Button } from '../ui/button';
import SelectWalletPopover from '../SelectWalletPopover';
import { useWallet, WalletInfo } from '@/contexts/WalletContext';
import { Avatar } from '../ui/avatar';
import Jdenticon from 'react-jdenticon';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Copy, LogOut } from 'lucide-react';
import { formatAddress } from '@/lib/utils';
import { useCopyToClipboard } from 'usehooks-ts';
import { toast } from 'sonner';

const HeaderUser = () => {
  const [isOpenWalletPopover, setIsOpenWalletPopover] = useState(false);
  const { availableWallets, onSelectWallet, isConnected, account, disconnect } =
    useWallet();
  const [, copyToClipboard] = useCopyToClipboard();
  const handleWalletSelect = async (wallet: WalletInfo) => {
    setIsOpenWalletPopover(false);
    onSelectWallet(wallet);
  };
  if (!isConnected) {
    return (
      <SelectWalletPopover
        open={isOpenWalletPopover}
        availableWallets={availableWallets}
        onOpenChange={setIsOpenWalletPopover}
        onSelectWallet={handleWalletSelect}
        contentClassName="mr-5 w-64"
      >
        <Button disabled={!availableWallets?.size}>Connect</Button>
      </SelectWalletPopover>
    );
  }
  return (
    <>
      <Popover>
        <PopoverTrigger className="cursor-pointer">
          <div className="p-0.5">
            <Avatar className="dark:bg-secondary flex h-8 w-8 items-center justify-center border bg-[#fff]">
              <Jdenticon value={account || ''} size={30} />
            </Avatar>
          </div>
        </PopoverTrigger>

        <PopoverContent className="mr-5 w-68 max-w-sm rounded-lg p-0">
          <div className="flex items-center space-x-3 border-b px-4 py-3">
            <Avatar className="dark:bg-secondary flex h-10 w-10 items-center justify-center border bg-[#fff]">
              <Jdenticon value={account || ''} size={38} />
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center justify-between space-x-2">
                <span className="font-sans text-sm leading-5 font-semibold">
                  {formatAddress(account || '')}
                </span>
                <button
                  className="cursor-pointer text-gray-500 hover:text-gray-700"
                  onClick={() => {
                    copyToClipboard(account || '');
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

          <div className="gap-2 p-2 px-3">
            <button
              onClick={disconnect}
              className="hover:bg-background-secondary flex w-full cursor-pointer items-center gap-3 rounded-md p-2 font-sans text-sm leading-6 font-medium -tracking-[0.14px]"
            >
              <LogOut size={20} className="text-gray-600" />
              <span>Disconnect</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
};

export default HeaderUser;
