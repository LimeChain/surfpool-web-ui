import '@/styles/globals.css';
import type { Metadata } from 'next';

const siteUrl = 'https://surfpool.run';
const siteName = 'Surfpool';
const title = 'Surfpool - From Localnet to Mainnet';
const description =
  'Drop-in replacement for solana-test-validator. Simulate programs locally using Mainnet accounts, deploy with Infrastructure as Code, and more.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s | Surfpool',
  },
  description,
  keywords: [
    'Solana development',
    'solana-test-validator alternative',
    'Solana simulation',
    'Mainnet forking',
    'SVM development',
    'Infrastructure as Code',
    'Solana deployment',
    'Runbooks',
    'Anchor development',
    'Solana localnet',
  ],
  authors: [{ name: 'Txtx' }],
  creator: 'Txtx',
  publisher: 'Txtx',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName,
    title,
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    creator: '@surfaboratory',
    site: '@surfaboratory',
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-128x128.png', sizes: '128x128', type: 'image/png' },
      { url: '/favicon-196x196.png', sizes: '196x196', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Surfpool',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Cross-platform',
    description,
    url: siteUrl,
    featureList: [
      'Mainnet account forking',
      'Drop-in solana-test-validator replacement',
      'Cheatcodes for testing',
      'Infrastructure as Code deployment',
      'Real-time transaction dashboard',
    ],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="help" href="/llms.txt" type="text/plain" title="LLM-friendly documentation" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="min-h-screen bg-black text-white antialiased">{children}</body>
    </html>
  );
}
