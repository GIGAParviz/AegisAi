'use client'

import { clsx } from 'clsx'
import { Check, Globe } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { localeNames, locales, type Locale } from '@/lib/i18n'
import { Link, usePathname } from '@/lib/navigation'

export function LocaleSwitcher({ dark }: { dark?: boolean }) {
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors',
          dark
            ? 'border-white/15 text-[#e8e6d8] hover:bg-white/10'
            : 'border-line bg-paper/60 text-text hover:bg-panel',
          open && !dark && 'bg-panel',
        )}
      >
        <Globe className={clsx('size-4', dark ? 'text-[#b8bd8e]' : 'text-muted')} />
        <span className="font-mono text-xs uppercase tracking-wider">{locale}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-1.5 w-40 overflow-hidden rounded-xl border border-line bg-paper shadow-lift"
        >
          {locales.map((l) => (
            <Link
              key={l}
              href={pathname ?? '/'}
              locale={l}
              scroll={false}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={clsx(
                'flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors',
                l === locale
                  ? 'bg-[#eef0e2] font-medium text-text'
                  : 'text-muted hover:bg-panel hover:text-text',
              )}
            >
              <span>
                <span className="me-2 font-mono text-xs uppercase tracking-wider text-faint">
                  {l}
                </span>
                {localeNames[l]}
              </span>
              {l === locale && <Check className="size-4 text-accent" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
