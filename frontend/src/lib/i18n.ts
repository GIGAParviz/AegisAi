export const locales = ['en', 'fa'] as const
export const defaultLocale = 'en' as const
export const localePrefix = 'always' as const

export type Locale = (typeof locales)[number]

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fa: 'فارسی',
}

export function isRTL(locale: string): boolean {
  return locale === 'fa'
}

export function localeFromPath(pathname: string | null | undefined): Locale {
  return pathname?.startsWith('/fa') ? 'fa' : 'en'
}
