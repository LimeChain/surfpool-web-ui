import type { Metadata } from 'next';
import '@/styles/tailwind.css';

export const metadata: Metadata = {
  title: 'SIMD-0296 - Ephemeral Network - Surfnet',
  description: 'SIMD-0296: Larger Transaction Sizes. Test transactions up to 4096 bytes with advanced cryptographic proofs and complex on-chain operations.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://simd-0296.surfnet.dev'),
  openGraph: {
    type: 'website',
    siteName: 'Surfnet',
    title: 'SIMD-0296 - Ephemeral Network',
    description: 'SIMD-0296: Larger Transaction Sizes. Test transactions up to 4096 bytes with advanced cryptographic proofs and complex on-chain operations.',
    images: ['/og/simd-0296.png'],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@surfnet',
    title: 'SIMD-0296 - Ephemeral Network',
    description: 'SIMD-0296: Larger Transaction Sizes. Test transactions up to 4096 bytes with advanced cryptographic proofs.',
    images: ['/og/simd-0296.png'],
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
