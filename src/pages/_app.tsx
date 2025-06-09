import { ThemeProvider } from '@/contexts/theme';
import 'katex/dist/katex.min.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Toaster } from '@/components/ui/sonner';
import { Web3Provider } from '@/contexts/Web3Provider';
import { PageSeo } from '@/components/common/PageSeo'; // Import PageSeo

export default function App({ Component, pageProps }: AppProps) {
  // Extract SEO props from pageProps
  const { seo } = pageProps;

  return (
    <ThemeProvider>
      <Web3Provider>
        {/* Render PageSeo with extracted props */}
        <PageSeo {...seo} />
        <Component {...pageProps} />
        <Toaster position="top-center" />
      </Web3Provider>
    </ThemeProvider>
  );
}
