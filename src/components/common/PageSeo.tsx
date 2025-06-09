import Head from 'next/head';
import { useRouter } from 'next/router';

interface PageSeoProps {
  title?: string;
  description?: string;
  image?: string;
  canonicalUrl?: string;
  keywords?: string;
}

const DEFAULT_TITLE_FALLBACK = 'Dwarves Memo';
const DEFAULT_DESCRIPTION = 'Knowledge sharing platform for Dwarves Foundation';
const SITE_URL = 'https://memo.d.foundation'; // Ensure this is correct

export function PageSeo({
  title,
  description,
  image,
  canonicalUrl,
  keywords,
}: PageSeoProps) {
  const router = useRouter();

  const pageTitle = title || DEFAULT_TITLE_FALLBACK;
  const pageDescription = description || DEFAULT_DESCRIPTION;
  // Ensure image URL is absolute
  const pageImage = image
    ? image.startsWith('http')
      ? image
      : `${SITE_URL}${image.startsWith('/') ? '' : '/'}${image}`
    : `${SITE_URL}/assets/home_cover.webp`; // Default image

  const currentUrl =
    canonicalUrl || `${SITE_URL}${router.asPath === '/' ? '' : router.asPath}`;

  return (
    <Head>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={pageImage} />
      <meta property="og:url" content={currentUrl} />
      <meta
        property="og:type"
        content={router.pathname === '/' ? 'website' : 'article'}
      />
      <meta property="og:site_name" content={DEFAULT_TITLE_FALLBACK} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageImage} />

      {/* Canonical URL */}
      <link rel="canonical" href={currentUrl} />
    </Head>
  );
}
