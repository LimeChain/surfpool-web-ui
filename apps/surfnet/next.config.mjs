/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export in production
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  transpilePackages: ['@surfpool/ui', '@surfpool/svm', '@surfpool/shared'],
};

export default nextConfig;
