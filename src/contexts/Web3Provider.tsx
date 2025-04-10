import { WagmiProvider, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { PropsWithChildren } from 'react';

const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [base, baseSepolia],

    // Required API Keys
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',

    // Required App Info
    appName: 'Dwarves Memo',

    // Optional App Info
    appUrl: 'https://memo.d.foundation', // your app's url
    appIcon: 'https://memo.d.foundation/assets/img/LOGO.png', // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: PropsWithChildren) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          customTheme={{
            '--ck-font-family': 'var(--font-monospace)',
            '--ck-primary-button-background': 'var(--muted)',
            '--ck-primary-button-hover-background': 'var(--border)',
            '--ck-primary-button-color': 'var(--muted-foreground)',
            '--ck-primary-button-hover-color': 'var(--muted-foreground)',
            '--ck-body-background': 'var(--background)',
            '--ck-body-color': 'var(--foreground)',
            '--ck-secondary-button-background': 'var(--secondary-background)',
            '--ck-secondary-button-color': 'var(--secondary-foreground)',
            '--ck-border-radius': 'var(--radius)',
            '--ck-overlay-background': 'rgba(0, 0, 0, 0.4)',
            '--ck-body-color-muted': 'var(--muted-foreground)',
            '--ck-body-color-muted-hover': 'var(--foreground)',
            '--ck-body-background-secondary': 'var(--muted)',
            '--ck-body-background-tertiary': 'var(--accent)',
            '--ck-body-border': 'var(--border)',
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
