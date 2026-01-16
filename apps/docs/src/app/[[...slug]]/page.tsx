import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { ReactNode } from 'react';
import {
  TransactionsRpc,
  AccountsRpc,
  CheatcodesRpc,
  NodeRpc,
  NetworkRpc,
  AdminRpc,
} from '@/components/rpc';
import { WebSocketsRpc } from '@/components/rpc/WebSocketsRpc';
import { rpcTocItems } from '@/lib/rpc-toc';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

// Custom components to override fumadocs defaults
const customComponents = {
  ...defaultMdxComponents,
  strong: ({ children }: { children: ReactNode }) => (
    <strong style={{ color: '#fafafa' }}>{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children: ReactNode }) => (
    <a href={href} style={{ color: '#00D4FF', textDecoration: 'none' }}>{children}</a>
  ),
  // RPC Components
  TransactionsRpc,
  AccountsRpc,
  CheatcodesRpc,
  NodeRpc,
  NetworkRpc,
  AdminRpc,
  WebSocketsRpc,
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  // Get the slug path for RPC TOC lookup
  const slugPath = slug?.join('/') || '';
  const rpcToc = rpcTocItems[slugPath] || [];

  // Merge page TOC with RPC TOC items
  const mergedToc = [...page.data.toc, ...rpcToc];

  return (
    <DocsPage toc={mergedToc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={customComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const siteUrl = 'https://docs.surfpool.io';
  const pageUrl = slug ? `${siteUrl}/${slug.join('/')}` : siteUrl;
  const pageTitle = page.data.title;
  const pageDescription = page.data.description || `Learn about ${pageTitle} in the Surfpool documentation.`;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${pageTitle} | Surfpool Docs`,
      description: pageDescription,
      url: pageUrl,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${pageTitle} | Surfpool Docs`,
      description: pageDescription,
    },
  };
}
