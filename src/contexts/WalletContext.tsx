/* eslint-disable @typescript-eslint/no-explicit-any */

import { ACTIVE_CHAIN } from '@/constants/nft';
import { ethers } from 'ethers';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export interface WalletInfo {
  name: string;
  icon: string;
  provider: ethers.Eip1193Provider;
}

interface WalletContextType {
  connect: (provider: ethers.Eip1193Provider) => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<boolean>;
  isConnected: boolean;
  isWrongChain: boolean;
  account: string | null;
  availableWallets: Map<string, WalletInfo>;
  currentWallet: WalletInfo | null;
  onSelectWallet: (wallet: WalletInfo) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [isWrongChain, setIsWrongChain] = useState(false);
  const [currentWallet, setCurrentWallet] = useState<WalletInfo | null>(null);
  const [availableWallets] = useState<Map<string, WalletInfo>>(new Map());
  const checkChain = async (provider: ethers.Eip1193Provider) => {
    try {
      const chainId = await provider.request({ method: 'eth_chainId' });
      return parseInt(chainId, 16) === ACTIVE_CHAIN.chainId;
    } catch (error) {
      console.error('Error checking chain:', error);
      return false;
    }
  };

  const switchChain = async () => {
    if (!currentWallet?.provider) return false;

    try {
      await currentWallet.provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ACTIVE_CHAIN.chainIdHex }],
      });
      return true;
    } catch (error: any) {
      if (error.code === -32603) {
        try {
          await currentWallet.provider.request({
            method: 'wallet_addEthereumChain',
            params: [ACTIVE_CHAIN],
          });
          return true;
        } catch (addError) {
          console.error('Error adding chain:', addError);
          return false;
        }
      }
      console.error('Error switching chain:', error);
      return false;
    }
  };

  const connect = useCallback(async (provider: ethers.Eip1193Provider) => {
    try {
      await provider
        .request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        })
        .catch(() => null);
      const newAccounts = await provider.request({
        method: 'eth_requestAccounts',
      });

      if (newAccounts?.[0]) {
        setAccount(newAccounts[0]);
        // Find and set the current wallet
        const walletInfo = Array.from(availableWallets.values()).find(
          wallet => wallet.provider === provider,
        );
        if (walletInfo) {
          setCurrentWallet(walletInfo);
        }
        const isCorrectChain = await checkChain(provider);
        setIsWrongChain(!isCorrectChain);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  }, []);

  const getAccounts = useCallback(async (wallet: ethers.Eip1193Provider) => {
    if (!wallet) return [];
    try {
      const accounts = await wallet.request({ method: 'eth_accounts' });
      return accounts;
    } catch (error) {
      console.error("Cannot get wallet's accounts", error);
      return [];
    }
  }, []);

  const updateRdnsForProvider = useCallback(
    (wallet: WalletInfo) => {
      if (!wallet) return null;

      for (const [rdns, walletInfo] of availableWallets.entries()) {
        if (walletInfo.provider === wallet.provider) {
          const connectedRdns = rdns;
          localStorage.setItem('connectedRdns', connectedRdns);
          return rdns;
        }
      }
      return null;
    },
    [availableWallets],
  );

  const disconnect = () => {
    setAccount(null);
    setCurrentWallet(null);
    setIsWrongChain(false);
    localStorage.setItem('connectedRdns', '');
  };

  const onSelectWallet = useCallback(
    async (wallet: WalletInfo) => {
      await connect(wallet.provider);
      setCurrentWallet(wallet);
      updateRdnsForProvider(wallet);
    },
    [connect, updateRdnsForProvider],
  );

  useEffect(() => {
    const handleProviderAnnouncement = async (event: any) => {
      const { info, provider } = event.detail;
      availableWallets.set(info.rdns, {
        name: info.name,
        icon: info.icon,
        provider,
      });

      provider.on('accountsChanged', async (accounts: string[]) => {
        if (currentWallet?.provider === provider) {
          setAccount(accounts[0] || null);
        }
      });

      provider.on('chainChanged', async () => {
        if (currentWallet?.provider === provider) {
          const isCorrectChain = await checkChain(provider);
          setIsWrongChain(!isCorrectChain);
        }
      });
      const connectedRdns = localStorage.getItem('connectedRdns');
      if (!currentWallet && connectedRdns === info.rdns) {
        const accounts = await getAccounts(provider);
        if (accounts?.length) {
          const newWallet = availableWallets.get(connectedRdns || '');
          if (newWallet) {
            setCurrentWallet(newWallet);
            updateRdnsForProvider(newWallet);
          }

          return;
        }
      }
    };

    window.addEventListener(
      'eip6963:announceProvider',
      handleProviderAnnouncement,
    );
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener(
        'eip6963:announceProvider',
        handleProviderAnnouncement,
      );
    };
  }, [availableWallets, currentWallet]);

  return (
    <WalletContext.Provider
      value={{
        connect,
        disconnect,
        switchChain,
        isConnected: !!account,
        isWrongChain,
        account,
        availableWallets,
        currentWallet,
        onSelectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
