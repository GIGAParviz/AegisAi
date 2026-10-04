'use client'

import { Menu } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/useAuth'
import { LocaleSwitcher } from './LocaleSwitcher'

export function Header({ onMenu }: { onMenu: () => void }) {
  const t = useTranslations('common')
  const locale = useLocale()
  const { user } = useAuthStore()
  const { logout } = useAuth()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenu}
          aria-label={t('menu')}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-panel hover:text-text lg:hidden"
        >
          <Menu className="size-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <LocaleSwitcher />
        <div className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-end sm:block">
              <p className="max-w-[16ch] truncate text-sm font-medium leading-tight text-text">
                {user.email}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
                {user.role.toLowerCase()}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-line bg-paper/60 px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-panel hover:text-text"
            >
              {t('logout')}
            </button>
          </div>
        ) : (
          <a
            href={`/${locale}/login`}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
          >
            {t('signIn')}
          </a>
        )}
      </div>
    </header>
  )
}
