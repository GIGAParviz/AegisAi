import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  allowedDevOrigins: ['172.24.64.1', '10.241.178.90', 'localhost'],
}

export default withNextIntl(nextConfig)
