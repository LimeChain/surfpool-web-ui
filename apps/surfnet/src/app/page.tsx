'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CompactSlotWidget, Faucet, solanaWebSocketService } from '@surfpool/svm';
import Footer from '@/components/footer';

interface NetworkConfig {
  network_name: string;
  network_description: string;
  network_instructions_md: string;
  network_url: string;
  rpc_url: string;
  ws_url: string;
  network_banner_image_square_url: string;
  network_banner_favicon_url: string;
  network_logo_image_url: string;
  primary_color: string;
  secondary_color: string;
}

export default function Home() {
  const [config, setConfig] = useState<NetworkConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/network-config.json')
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
        // Update favicon
        const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (favicon && data.network_banner_favicon_url) {
          favicon.href = data.network_banner_favicon_url;
        }
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
        <div className="relative h-[300px] w-full lg:h-[400px]" style={{
          background: `linear-gradient(135deg, ${config.primary_color} 0%, ${config.secondary_color} 100%)`,
        }}>
          {/* Slot Widget - Top Right */}
          <div className="absolute right-4 top-4 z-10 lg:right-8 lg:top-8">
            <CompactSlotWidget
              rpcUrl={config.rpc_url}
              wsUrl={config.ws_url}
              solanaWebSocketService={solanaWebSocketService}
            />
          </div>
        </div>

        {/* Horizontal line after banner */}
        <div className="border-b border-zinc-800" />

        {/* Profile Section */}
        <div className="relative px-4">
          {/* Profile Picture - Overlapping banner */}
          <div className="absolute -top-16 left-4 lg:-top-20 lg:left-8">
            <img
              src={config.network_banner_image_square_url}
              alt={config.network_name}
              className="h-32 w-32 rounded-full border-4 border-black lg:h-40 lg:w-40"
            />
          </div>

          {/* Edit Profile Button */}
          <div className="flex justify-end pt-4 pr-4 lg:pt-6 lg:pr-8">
            <button className="rounded-full border border-zinc-700 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-900">
              Edit profile
            </button>
          </div>

          {/* Name and Handle */}
          <div className="mt-16 px-4 lg:px-8">
            <h1 className="text-xl font-bold lg:text-2xl">{config.network_name}</h1>
            <p className="mt-1 text-zinc-500">@{config.network_name.toLowerCase().replace(/\s+/g, '')}</p>

            {/* Description */}
            <p className="mt-4 text-[15px] leading-5">{config.network_description}</p>

            {/* Action Buttons */}
            <div className="mt-4 flex gap-3 pb-6">
              <a
                href={config.network_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-6 py-2 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: config.primary_color }}
              >
                Visit Website
              </a>
              <button className="rounded-lg border border-zinc-700 bg-transparent px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-900">
                View Explorer
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal line after profile section */}
        <div className="border-b border-zinc-800" />

        {/* Two-column Layout */}
        <div className="grid grid-cols-1 items-start gap-8 py-8 px-4 lg:grid-cols-[1fr_450px]">
          {/* Main Content */}
          <div className="w-full">
            <div className="space-y-6">
              {/* Pinned Post Style */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                  </svg>
                  <span>Pinned</span>
                </div>
                <article className="prose prose-zinc max-w-none prose-invert prose-headings:text-white prose-p:text-zinc-300 prose-a:text-purple-400 prose-code:text-white prose-code:bg-zinc-800 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {config.network_instructions_md}
                  </ReactMarkdown>
                </article>
              </div>
            </div>
          </div>

          {/* Sidebar - Fixed 450px width like studio */}
          <div className="w-full lg:w-[450px] lg:max-w-[450px] lg:min-w-[450px]">
            <div className="space-y-4">
              {/* Faucet Widget */}
              <Faucet rpcUrl={config.rpc_url} />

              {/* Network Stats */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="mb-4 text-lg font-bold">Network Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Status</span>
                    <span className="flex items-center gap-1.5 font-medium text-green-400">
                      <span className="h-2 w-2 rounded-full bg-green-400" />
                      Online
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Block Time</span>
                    <span className="font-medium">~400ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">TPS</span>
                    <span className="font-medium">2,500</span>
                  </div>
                </div>
              </div>

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
