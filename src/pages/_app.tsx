import { ThemeProvider } from '@/contexts/theme';
import 'katex/dist/katex.min.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Toaster } from '@/components/ui/sonner';
import { Web3Provider } from '@/contexts/Web3Provider';
import { SoundProvider } from '@/contexts/SoundProvider';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const handleCopyLink = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (target.closest('[data-heading-id]')) {
        const headingId = target
          .closest('[data-heading-id]')
          ?.getAttribute('data-heading-id');
        if (headingId) {
          const currentUrl = new URL(window.location.href);
          currentUrl.hash = headingId;
          window.location.hash = headingId; // Navigate to the hash
          navigator.clipboard.writeText(currentUrl.toString()).catch(err => {
            console.error('Failed to copy link: ', err);
          });
        }
      }
    };

    document.addEventListener('click', handleCopyLink);

    return () => {
      document.removeEventListener('click', handleCopyLink);
    };
  }, [router]); // Re-run effect if router changes (e.g., page navigation)

  return (
    <ThemeProvider>
      <SoundProvider>
        <Web3Provider>
          <Component {...pageProps} />
          <Toaster position="top-center" />
        </Web3Provider>
      </SoundProvider>
    </ThemeProvider>
  );
}
