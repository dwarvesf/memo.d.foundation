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
          options={{ embedGoogleFonts: true }}
          customTheme={{
            '--ck-font-family': 'var(--font-sans)',
            '--ck-primary-button-background': 'var(--muted)',
            '--ck-primary-button-hover-background': 'var(--border)',
            '--ck-primary-button-color': 'var(--muted-foreground)',
            '--ck-primary-button-hover-color': 'var(--muted-foreground)',
            '--ck-primary-button-font-weight': 400,
            '--ck-primary-button-border-radius': 'var(--radius)',
            '--ck-body-background': 'var(--background)',
            '--ck-body-color': 'var(--foreground)',
            '--ck-secondary-button-background': 'var(--secondary-background)',
            '--ck-secondary-button-color': 'var(--secondary-foreground)',
            '--ck-border-radius': 'var(--radius)',
            '--ck-overlay-background':
              'color-mix(in oklab, var(--color-black) 50%, transparent)',
            '--ck-body-color-muted': 'var(--muted-foreground)',
            '--ck-body-color-muted-hover': 'var(--foreground)',
            '--ck-body-background-secondary': 'var(--muted)',
            '--ck-body-background-tertiary': 'var(--accent)',
            '--ck-body-border': 'var(--border)',
            '--ck-body-color-danger': 'var(--primary)',
            '--ck-modal-box-shadow':
              '0px 4px 6px -2px var(--tw-shadow-color, #10182808), 0px 12px 16px -4px var(--tw-shadow-color, #10182814)',
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
