import { useAccountEffect, WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RainbowKitProvider,
  Theme,
  darkTheme,
  getDefaultConfig,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { PropsWithChildren } from 'react';
import { WALLETCONNECT_PROJECT_ID } from '@/constants/nft';
import '@rainbow-me/rainbowkit/styles.css';
import { useThemeContext } from './theme';
import { merge } from 'lodash';

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
export const Web3ProviderInner = ({ children }: PropsWithChildren) => {
  useAccountEffect({
    onConnect(data) {
      localStorage.setItem('loggedInAddress', data.address);
    },
    onDisconnect() {
      localStorage.removeItem('loggedInAddress');
      console.log('Disconnected');
    },
  });
  return children;
};

const customBaseTheme: RecursivePartial<Theme> = {
  blurs: {
    modalOverlay: 'small',
  },

  colors: {
    accentColor: 'var(--primary)',
    accentColorForeground: 'var(--primary-foreground)',
    actionButtonBorder: 'transparent',
    actionButtonBorderMobile: 'transparent',
    actionButtonSecondaryBackground: 'var(--muted)',
    closeButton: 'var(--muted-foreground)',
    closeButtonBackground: 'var(--muted)',
    connectButtonBackground: 'var(--muted)',
    connectButtonBackgroundError: 'var(--primary)',
    connectButtonInnerBackground: 'var(--background)',
    connectButtonText: 'var(--muted-foreground)',
    connectButtonTextError: 'var(--primary-foreground)',
    connectionIndicator: 'var(--primary)',
    error: 'var(--primary)',
    generalBorder: 'var(--border)',
    generalBorderDim: 'var(--border)',
    menuItemBackground: 'var(--muted)',
    modalBackdrop: 'color-mix(in oklab, var(--color-black) 50%, transparent)',
    modalBackground: 'var(--background)',
    modalBorder: 'var(--border)',
    modalText: 'var(--foreground)',
    modalTextDim: 'var(--muted-foreground)',
    modalTextSecondary: 'var(--muted-foreground)',
    profileAction: 'var(--muted)',
    profileActionHover: 'var(--accent)',
    profileForeground: 'var(--foreground)',
    selectedOptionBorder: 'var(--primary)',
    standby: 'var(--primary)',
  },
  radii: {
    actionButton: 'var(--radius)',
    connectButton: 'var(--radius)',
    menuButton: 'var(--radius)',
    modal: 'var(--radius)',
    modalMobile: 'var(--radius)',
  },
  fonts: {
    body: 'var(--font-sans)',
  },
};

const customLightTheme = merge(lightTheme(), customBaseTheme, {});
const customDarkTheme = merge(darkTheme(), customBaseTheme, {});

export const Web3Provider = ({ children }: PropsWithChildren) => {
  const { theme } = useThemeContext();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme === 'dark' ? customDarkTheme : customLightTheme}
        >
          <style jsx global>{`
            [data-rk] .ju367v1g {
              font-weight: 500;
            }
            [data-rk] .ju367v1h {
              font-weight: 500;
            }

            [data-rk] .ju367v1i {
              font-weight: 600;
            }
          `}</style>
          <Web3ProviderInner>{children}</Web3ProviderInner>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
