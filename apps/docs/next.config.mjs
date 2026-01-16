import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@surfpool/ui', '@surfpool/shared'],
  turbopack: {
    rules: {
      // Only apply SVGR to SVGs from packages/ui, not public assets
      '../../packages/ui/**/*.svg': {
        loaders: [
          {
            loader: '@svgr/webpack',
            options: {
              svgoConfig: {
                plugins: [
                  {
                    name: 'removeViewBox',
                    active: false,
                  },
                  {
                    name: 'removeDimensions',
                    active: true,
                  },
                ],
              },
            },
          },
        ],
        as: '*.js',
      },
    },
  },
};

export default withMDX(nextConfig);
