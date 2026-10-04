import { clsx } from 'clsx'

export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className,
}: {
  kicker?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-4',
        className,
      )}
    >
      <div className="min-w-0">
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 className="display text-4xl sm:text-[2.75rem]">{title}</h1>
        {subtitle && (
          <p className="prose-serif mt-2 max-w-2xl text-[17px] leading-relaxed text-muted">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}
