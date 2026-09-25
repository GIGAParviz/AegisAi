import type { Metadata, Viewport } from 'next'
import { Inter, IBM_Plex_Mono, Vazirmatn } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-mono',
  display: 'swap',
})

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-vazir',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AegisAI — Production AI Knowledge Workspace',
  description: 'Document ingestion, retrieval, RAG, agent workflows, evaluation, and local model serving.',
  keywords: ['AI', 'RAG', 'LLM', 'document processing', 'vector search', 'agent workflows'],
}

export const viewport: Viewport = {
  themeColor: '#f3f0e3',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${ibmPlexMono.variable} ${vazirmatn.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-bg font-sans text-text">{children}</body>
    </html>
  )
}