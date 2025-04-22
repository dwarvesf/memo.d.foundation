import { ThemeProvider } from '@/contexts/theme';
import 'katex/dist/katex.min.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Toaster } from '@/components/ui/sonner';
import dynamic from 'next/dynamic';
import { Web3Provider } from '@/contexts/Web3Provider';

const DynamicWeb3Provider = dynamic(() => Promise.resolve(Web3Provider), {
  ssr: false,
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <DynamicWeb3Provider>
        <Component {...pageProps} />
        <Toaster position="top-center" />
      </DynamicWeb3Provider>
    </ThemeProvider>
  );
}
