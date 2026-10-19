'use client'

import { ArrowRight, Compass, Hammer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageBody } from '@/components/layout/WorkspaceShell'
import { StatusPill } from '@/components/ui/StatusPill'
import { Link } from '@/lib/navigation'

export function ComingSoonPage({
  navKey,
  copyKey,
  phase,
}: {
  navKey: string
  copyKey: string
  phase: string
}) {
  const t = useTranslations('coming')
  const tn = useTranslations('nav')
  const tc = useTranslations('common')

  return (
    <PageBody className="fade-up">
      <PageHeader
        kicker={t('kicker')}
        title={tn(navKey)}
        actions={<StatusPill tone="muted" label={tc('comingSoon')} />}
      />
      <p className="prose-serif mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
        {t(copyKey)}
      </p>

      <section className="card-paper relative mt-10 overflow-hidden">
        <div className="reading-surface !border-0 !bg-transparent p-8 sm:p-12">
          <div className="flex flex-col items-center text-center">
            <span className="grid size-16 place-items-center rounded-2xl border border-line bg-paper text-accent shadow-soft">
              <Hammer className="size-8" />
            </span>
            <p className="display mt-6 text-2xl">{t('title')}</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{t('notifyMe')}</p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/app/dashboard"
                className="group inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
              >
                {t('backToDashboard')}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                <Compass className="size-3.5 text-accent" />
                {t('phaseLabel')}: {phase}
              </span>
            </div>
          </div>
        </div>
      </section>
    </PageBody>
  )
}
