import { WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import { PropsWithChildren } from 'react';
import { WALLETCONNECT_PROJECT_ID } from '@/constants/nft';

const config = getDefaultConfig({
  // Your dApps chains
  chains: [base, baseSepolia],

  // Required API Keys
  projectId: WALLETCONNECT_PROJECT_ID,

  // Required App Info
  appName: 'Dwarves Memo',

  // Optional App Info
  appUrl: 'https://memo.d.foundation', // your app's url
  appIcon: 'https://memo.d.foundation/assets/img/LOGO.png', // your app's icon, no bigger than 1024x1024px (max. 1MB)
  ssr: true,
});

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: PropsWithChildren) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: 'var(--muted)',
            accentColorForeground: 'var(--muted-foreground)',
            fontStack: 'system',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
