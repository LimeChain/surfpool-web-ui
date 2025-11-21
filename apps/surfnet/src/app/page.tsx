'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CompactSlotWidget, Faucet, solanaWebSocketService } from '@surfpool/svm';
import { getSolanaExplorerUrl } from '@surfpool/shared';
import Footer from '@/components/footer';

interface NetworkConfig {
  network_name: string;
  network_handle: string;
  network_description: string;
  network_url: string;
  rpc_url: string;
  ws_url: string;
  network_banner_image_url: string;
  network_logo_image_url: string;
  primary_color: string;
  secondary_color: string;
  primary_button?: {
    label: string;
    url: string;
    color: string;
  };
  faucet_enabled: boolean;
  faucet_amount_sol: number;
  faucet_daily_limit_sol: number;
  faucet_cooldown_minutes: number;
}

export default function Home() {
  const [config, setConfig] = useState<NetworkConfig | null>(null);
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hostname = window.location.hostname;
    const searchParams = new URLSearchParams(window.location.search);
    let networkId = 'default';

    // On localhost, check for query parameter first (e.g., localhost:3001/?simd-0296)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Get the first query parameter key (e.g., "simd-0296" from "?simd-0296")
      const params = Array.from(searchParams.keys());
      if (params.length > 0) {
        networkId = params[0];
      }
    } else {
      // Extract subdomain (e.g., "simd-0296" from "simd-0296.surfnet.dev")
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        // Has subdomain (e.g., ["simd-0296", "surfnet", "dev"])
        networkId = parts[0];
      }
    }

    console.log(`Loading config for network: ${networkId}`);

    // Load config.json and index.md in parallel
    Promise.all([
      fetch(`/${networkId}/config.json`)
        .then((res) => {
          if (!res.ok) {
            console.warn(`Config file ${networkId}/config.json not found, falling back to default`);
            return fetch('/default/config.json');
          }
          return res;
        })
        .then((res) => res.json()),
      fetch(`/${networkId}/index.md`)
        .then((res) => {
          if (!res.ok) {
            console.warn(`Markdown file ${networkId}/index.md not found, falling back to default`);
            return fetch('/default/index.md');
          }
          return res;
        })
        .then((res) => res.text())
    ])
      .then(([configData, markdownData]) => {
        setConfig(configData);
        setMarkdown(markdownData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load network configuration:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-lg text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-lg text-red-600">Failed to load network configuration</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Main wrapper with vertical lines */}
      <div className="mx-auto max-w-[1265px] min-h-screen border-x border-zinc-800">
        {/* Banner Header */}
        <div className="relative h-[300px] w-full lg:h-[400px]">
          <img
            src={`/${config.network_banner_image_url}`}
            alt={`${config.network_name} Banner`}
            className="h-full w-full object-cover"
          />
          {/* Slot Widget - Top Right */}
          <div className="absolute right-4 top-4 z-10 lg:right-8 lg:top-8">
            <CompactSlotWidget
              rpcUrl={config.rpc_url}
              wsUrl={config.ws_url}
              solanaWebSocketService={solanaWebSocketService}
            />
          </div>
          {/* Logo - Overlapping banner */}
          <div className="absolute bottom-0 left-4 translate-y-1/2 lg:left-8">
            <img
              src={`/${config.network_logo_image_url}`}
              alt={config.network_name}
              className="h-32 w-32 rounded-xl border-4 border-black lg:h-40 lg:w-40"
            />
          </div>
        </div>

        {/* Horizontal line after banner */}
        <div className="border-b border-zinc-800" />

        {/* Profile Section */}
        <div className="relative px-4">
          {/* Name and Handle */}
          <div className="mt-20 px-4 lg:mt-24 lg:px-8">
            <h1 className="text-xl font-bold lg:text-2xl">{config.network_name}</h1>
            <p className="mt-1 text-zinc-500">@{config.network_handle}</p>

            {/* Description */}
            <p className="mt-3 text-[15px] leading-5">{config.network_description}</p>

            {/* Action Buttons */}
            <div className="mt-4 flex gap-3 pb-6">
              {config.primary_button && (
                <a
                  href={config.primary_button.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-6 py-2 text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: config.primary_button.color }}
                >
                  {config.primary_button.label}
                </a>
              )}
              <a
                href={getSolanaExplorerUrl(config.rpc_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-700 bg-transparent px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-900"
              >
                View Explorer
              </a>
            </div>
          </div>
        </div>

        {/* Horizontal line after profile section */}
        <div className="border-b border-zinc-800" />

        {/* Two-column Layout */}
        <div className="grid grid-cols-1 items-start gap-8 py-8 px-4 lg:grid-cols-[1fr_450px] bg-zinc-950">
          {/* Main Content */}
          <div className="w-full">
            <div className="space-y-6">
              <div className="rounded-2xl bg-zinc-950 p-6">
                <article className="prose prose-zinc max-w-none prose-invert prose-headings:text-white prose-p:text-zinc-300 prose-a:text-purple-400 prose-code:text-white prose-code:bg-zinc-800 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {markdown}
                  </ReactMarkdown>
                </article>
              </div>
            </div>
          </div>

          {/* Sidebar - Fixed 450px width like studio */}
          <div className="w-full lg:w-[450px] lg:max-w-[450px] lg:min-w-[450px]">
            <div className="space-y-4">
              {/* Faucet Widget */}
              {config.faucet_enabled && <Faucet rpcUrl={config.rpc_url} />}

              {/* Quick Links */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="mb-4 text-lg font-bold">Quick Links</h3>
                <div className="space-y-2">
                  <a href="#" className="block rounded-lg p-2 text-sm transition-colors hover:bg-zinc-900">
                    📚 Documentation
                  </a>
                  <a href="#" className="block rounded-lg p-2 text-sm transition-colors hover:bg-zinc-900">
                    💬 Discord
                  </a>
                  <a href="#" className="block rounded-lg p-2 text-sm transition-colors hover:bg-zinc-900">
                    🐦 Twitter
                  </a>
                  <a href="#" className="block rounded-lg p-2 text-sm transition-colors hover:bg-zinc-900">
                    📖 GitHub
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
