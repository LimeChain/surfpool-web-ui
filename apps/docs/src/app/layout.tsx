import { Analytics } from '@vercel/analytics/next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { source } from '@/lib/source';
import { SidebarLogo } from '@/components/themed-logo';
import '@/styles/tailwind.css';

const siteUrl = 'https://docs.surfpool.run';
const siteName = 'Surfpool Documentation';
const title = 'Surfpool Docs - From Localnet to Mainnet';
const description =
  'Learn how to use Surfpool, a drop-in replacement for solana-test-validator. Simulate programs locally using Mainnet accounts, deploy with Infrastructure as Code, and more.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: '%s | Surfpool Docs',
    default: title,
  },
  description,
  keywords: [
    'Surfpool documentation',
    'Solana development',
    'solana-test-validator alternative',
    'Solana simulation',
    'Infrastructure as Code',
    'Solana deployment',
    'SVM development',
    'Runbooks',
    'Mainnet simulation',
    'Anchor development',
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
    ],
    apple: '/favicon-196x196.png',
  },
  other: {
    'msapplication-TileColor': '#00D4FF',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: siteName,
        description,
        publisher: { '@id': 'https://surfpool.run/#txtx' },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}/?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': 'https://surfpool.run/#txtx',
        name: 'Txtx',
        url: 'https://txtx.builders',
        sameAs: [
          'https://twitter.com/surfaboratory',
          'https://github.com/txtx/surfpool',
        ],
      },
      {
        '@type': 'TechArticle',
        '@id': `${siteUrl}/#article`,
        headline: title,
        description,
        author: { '@id': 'https://surfpool.run/#txtx' },
        publisher: { '@id': 'https://surfpool.run/#txtx' },
        mainEntityOfPage: siteUrl,
        about: [
          { '@type': 'Thing', name: 'Solana Development' },
          { '@type': 'Thing', name: 'Blockchain Infrastructure' },
          { '@type': 'Thing', name: 'Developer Documentation' },
        ],
      },
    ],
  };

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="help" href="/llms.txt" type="text/plain" title="LLM-friendly documentation" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          theme={{
            defaultTheme: 'dark',
            attribute: 'class',
          }}
        >
          <DocsLayout
            tree={source.pageTree}
            nav={{
              title: <SidebarLogo />,
            }}
            sidebar={{
              footer: (
                <a
                  href="/llms.txt"
                  className="block px-2 py-4 font-mono text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
                >
                  llms.txt
                </a>
              ),
            }}
          >
            {children}
          </DocsLayout>
        </RootProvider>
        <Analytics />
      </body>
    </html>
  );
}
