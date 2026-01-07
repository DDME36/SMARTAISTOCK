import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BlockHunter',
  description: 'Smart Money Concept Stock Alert - Hunt Order Blocks like a pro',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg', apple: '/icon.svg' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BlockHunter'
  },
  formatDetection: {
    telephone: false
  }
}

export const viewport: Viewport = {
  themeColor: '#0B0E14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
