import { ThemeProvider } from '@/contexts/theme';
import 'katex/dist/katex.min.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Toaster } from '@/components/ui/sonner';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
      <Toaster position="top-center" />
    </ThemeProvider>
  );
}
