import { ThemeProvider } from '@/contexts/theme';
import 'katex/dist/katex.min.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Toaster } from '@/components/ui/sonner';
import { Web3Provider } from '@/contexts/Web3Provider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Web3Provider>
        <Component {...pageProps} />
        <Toaster position="top-center" />
      </Web3Provider>
    </ThemeProvider>
  );
}
