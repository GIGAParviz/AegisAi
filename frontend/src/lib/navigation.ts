import { createNavigation } from 'next-intl/navigation'
import { defaultLocale, localePrefix, locales } from './i18n'

// Locale-prefixed navigation. We intentionally don't localize pathnames:
// URLs stay identical under /en and /fa (e.g. /fa/app/dashboard), which keeps
// sidebar highlighting, deep links and the proxy layer simple.
export const { Link, getPathname, useRouter, usePathname } = createNavigation({
  locales,
  defaultLocale,
  localePrefix,
})
