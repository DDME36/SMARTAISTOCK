/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.parqet.com' }
    ]
  },
  reactStrictMode: true
}

module.exports = nextConfig
