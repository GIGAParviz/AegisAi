'use client'

import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight, Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/lib/navigation'
import { iconMap } from './icons'
import { navGroups } from '@/lib/nav-model'

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
}: {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
}) {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const tc = useTranslations('common')

  return (
    <aside
      aria-label="Main navigation"
      className={clsx(
        'fixed inset-y-0 start-0 z-40 flex flex-col border-e border-line bg-panel transition-[width,transform] duration-300',
        collapsed ? 'w-[72px]' : 'w-64',
        'max-lg shadow-lift',
        mobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0',
      )}
    >
      {/* Brand */}
      <div
        className={clsx(
          'flex h-16 shrink-0 items-center border-b border-line px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        {!collapsed ? (
          <Link href="/" className="flex items-center gap-2.5" aria-label="AegisAI home">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-paper">
              <Shield className="size-4.5" />
            </span>
            <span className="display text-[22px] leading-none">AegisAI</span>
          </Link>
        ) : (
          <Link href="/" className="grid size-8 place-items-center rounded-lg bg-accent text-paper" aria-label="AegisAI home">
            <Shield className="size-4.5" />
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.key} className="mb-5 last:mb-0">
            {!collapsed && (
              <p className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-[1.4px] text-faint">
                {t(group.key)}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = iconMap[item.icon]
                if (!Icon) return null
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? t(item.key) : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-accent text-paper shadow-soft'
                          : 'text-muted hover:bg-[#e0ddcd] hover:text-text',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                      {!collapsed && (
                        <>
                          <span className="min-w-0 flex-1 truncate">{t(item.key)}</span>
                          {item.status === 'soon' && (
                            <span className="shrink-0 rounded-full border border-line bg-paper px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-faint">
                              {tc('comingSoon')}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="hidden border-t border-line p-2 lg:block">
        <button
          onClick={onToggle}
          className={clsx(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted transition-colors hover:bg-[#e0ddcd] hover:text-text',
            collapsed && 'justify-center px-0',
          )}
          aria-label={tc('toggleSidebar')}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ChevronRight className="size-[18px] rtl:rotate-180" />
          ) : (
            <>
              <ChevronLeft className="size-[18px] rtl:rotate-180" />
              <span>{tc('collapse')}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
