import type { Metadata } from 'next';
import '@/styles/tailwind.css';

export const metadata: Metadata = {
  title: 'Surfnet',
  description: 'Surfnet - A high-performance Solana-based testnet',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://surfnet.dev'),
  openGraph: {
    type: 'website',
    siteName: 'Surfnet',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@surfnet',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full bg-black text-zinc-950 antialiased dark:bg-black dark:text-white">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
