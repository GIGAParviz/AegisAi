import { getRequestConfig } from 'next-intl/server'
import { locales, defaultLocale } from './src/lib/i18n'

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = locale || defaultLocale
  const messages = (await import(`./src/messages/${resolvedLocale}.json`)).default
  return {
    locale: resolvedLocale,
    messages,
    timeZone: 'UTC',
  }
})