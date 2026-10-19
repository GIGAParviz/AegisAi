'use client'

import { clsx } from 'clsx'

/** Soft status dot + label pill in the paper theme. */
export function StatusPill({
  tone,
  label,
  pulse,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'muted'
  label: string
  pulse?: boolean
}) {
  const tones = {
    ok: 'bg-[#e9efdd] text-[#4c5a3a] border-[#c6ceb3]',
    warn: 'bg-[#f4ecd8] text-[#7a5f22] border-[#e2d2a4]',
    danger: 'bg-[#f3e2e8] text-[#883250] border-[#dcb9c7]',
    muted: 'bg-panel text-muted border-line',
  }
  const dots = {
    ok: 'bg-[#68734b]',
    warn: 'bg-[#b08a3c]',
    danger: 'bg-warm',
    muted: 'bg-faint',
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-wide',
        tones[tone],
      )}
    >
      <span className={clsx('size-1.5 rounded-full', dots[tone], pulse && 'pulse-dot')} />
      {label}
    </span>
  )
}
