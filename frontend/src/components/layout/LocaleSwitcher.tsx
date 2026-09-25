'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Globe } from 'lucide-react'
import { locales, localeNames, type Locale } from '@/lib/i18n'

export function LocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const currentLocale = (pathname.split('/')[1] as Locale) || 'en'

  const switchLocale = (locale: Locale) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`)
    startTransition(() => {
      router.push(newPath)
    })
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        className="flex items-center gap-2 px-3 py-1.5 bg-panel border border-line rounded-lg text-sm font-medium text-text hover:bg-line transition-colors"
        aria-label="Switch language"
        aria-expanded="false"
      >
        <Globe className="h-4 w-4 text-muted" />
        <span className="font-mono uppercase tracking-wider">{currentLocale.toUpperCase()}</span>
      </button>
      <div className="absolute right-0 mt-1 w-32 bg-panel border border-line rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200" role="menu">
        {locales.map((locale) => (
          <button
            key={locale}
            onClick={() => switchLocale(locale)}
            disabled={isPending || locale === currentLocale}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
              locale === currentLocale
                ? 'bg-accent text-white'
                : 'text-text hover:bg-line'
            }`}
            role="menuitem"
            aria-selected={locale === currentLocale}
          >
            <span className="font-mono uppercase tracking-wider text-xs">{locale.toUpperCase()}</span>
            <span className="text-muted">{localeNames[locale]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}