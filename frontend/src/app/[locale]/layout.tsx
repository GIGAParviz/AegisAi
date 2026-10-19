import type { Metadata, Viewport } from 'next'
import { Inter, IBM_Plex_Mono, Vazirmatn } from 'next/font/google'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { isRTL, locales, type Locale } from '@/lib/i18n'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-plex-mono',
  display: 'swap',
})

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-vazirmatn',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#f3f0e3',
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })
  return {
    title: { default: t('title'), template: '%s · AegisAI' },
    description: t('description'),
  }
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!locales.includes(locale as Locale)) notFound()
  // Deterministic static rendering for SSG pages (next-intl requirement).
  setRequestLocale(locale)

  const messages = await getMessages({ locale })

  return (
    <html
      lang={locale}
      dir={isRTL(locale) ? 'rtl' : 'ltr'}
      className={`${inter.variable} ${plexMono.variable} ${vazirmatn.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans text-text">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
