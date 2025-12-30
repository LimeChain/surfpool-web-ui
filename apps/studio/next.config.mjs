import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export in production
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  transpilePackages: ['@surfpool/ui', '@surfpool/svm', '@surfpool/shared', '@moneymq/react', '@solana/connector', 'lottie-react'],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer/'),
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      tslib: require.resolve('tslib'),
      // Stub out problematic wallet adapters
      '@particle-network/auth': false,
      '@particle-network/solana-wallet': false,
      '@keystonehq/sol-keyring': false,
      '@keystonehq/sdk': false,
      '@trezor/connect-web': false,
      '@trezor/connect': false,
      // Ignore pino-pretty (optional dep of @walletconnect/logger)
      'pino-pretty': false,
    };
    return config;
  },
};

export default nextConfig;
