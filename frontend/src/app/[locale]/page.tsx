import { useTranslations } from 'next-intl'
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Database,
  FileStack,
  Hammer,
  Lock,
  MessageSquare,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Waypoints,
  Zap,
} from 'lucide-react'
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher'
import { Link } from '@/lib/navigation'

const pipeline = [
  { key: 'gateway', icon: Server },
  { key: 'context', icon: Database },
  { key: 'reasoning', icon: Sparkles },
  { key: 'policy', icon: Lock },
  { key: 'execution', icon: Boxes },
  { key: 'verify', icon: ShieldCheck },
  { key: 'observe', icon: Waypoints },
] as const

const features = [
  { key: 'ingest', icon: FileStack, live: true },
  { key: 'searchReady', icon: Search, live: true },
  { key: 'chat', icon: MessageSquare, live: true },
  { key: 'auth', icon: ShieldCheck, live: true },
  { key: 'policy', icon: ClipboardCheck, live: true },
  { key: 'local', icon: Zap, live: true },
] as const

const phases = [
  { key: 'p0', state: 'done' },
  { key: 'p1', state: 'done' },
  { key: 'p2', state: 'done' },
  { key: 'p3', state: 'active' },
  { key: 'p4', state: 'active' },
  { key: 'p5', state: 'next' },
  { key: 'p6', state: 'next' },
  { key: 'p7', state: 'next' },
] as const

export default function LandingPage() {
  const t = useTranslations('landing')
  const tc = useTranslations('common')

  return (
    <div className="min-h-screen">
      {/* ── Public header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
        <div className="wrap flex h-16 items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-paper">
              <ShieldCheck className="size-[18px]" />
            </span>
            <span className="display text-[22px] leading-none">AegisAI</span>
          </span>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#pipeline" className="hidden text-sm text-muted transition-colors hover:text-text md:block">
              {t('pipelineKicker')}
            </a>
            <a href="#features" className="hidden text-sm text-muted transition-colors hover:text-text md:block">
              {t('featuresKicker')}
            </a>
            <a href="#roadmap" className="hidden text-sm text-muted transition-colors hover:text-text md:block">
              {t('roadmapKicker')}
            </a>
            <LocaleSwitcher />
            <Link
              href="/app/dashboard"
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
            >
              {t('ctaPrimary')}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="fade-up relative overflow-hidden">
          <div className="wrap grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-paper/70 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">
                <span className="pulse-dot size-1.5 rounded-full bg-[#68734b]" />
                {t('badge')}
              </p>
              <h1 className="display text-[clamp(44px,7vw,84px)]">
                {t('heroLine1')}{' '}
                <span className="prose-serif block text-accent">{t('heroLine2')}</span>
              </h1>
              <p className="prose-serif mt-6 max-w-xl text-[19px]/[1.7] text-muted">{t('subtitle')}</p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[15px] font-medium text-paper shadow-soft transition-colors hover:bg-accent-deep"
                >
                  {t('createAccount')}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </Link>
                <a
                  href="#pipeline"
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-6 py-3.5 text-[15px] font-medium text-text transition-colors hover:bg-panel"
                >
                  {t('ctaSecondary')}
                </a>
              </div>
            </div>

            {/* Pipeline mock card */}
            <div className="relative hidden lg:block" aria-hidden="true">
              <div className="card-paper -rotate-[1.5deg] p-6 shadow-lift">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <span className="font-mono text-xs uppercase tracking-wider text-faint">
                    request · /chat/stream
                  </span>
                  <span className="rounded-full bg-[#e9efdd] px-2 py-0.5 font-mono text-[10px] text-[#4c5a3a]">
                    trace 8f2c…
                  </span>
                </div>
                <ul className="mt-4 space-y-3">
                  {(['gateway', 'context', 'reasoning', 'policy', 'verify'] as const).map((s, i) => (
                    <li key={s} className="flex items-center gap-3">
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-lg ${
                          i === 3 ? 'bg-warm/10 text-warm' : 'bg-[#e9efdd] text-[#4c5a3a]'
                        }`}
                      >
                        {i === 3 ? <Lock className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                      </span>
                      <span className="flex-1 text-sm text-text">{t(`stages.${s}.name`)}</span>
                      <span
                        className={`h-1.5 rounded-full ${i === 3 ? 'w-16 bg-warm/25' : 'w-24 bg-[#dfe4cd]'}`}
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-xl border border-line bg-panel/70 p-4">
                  <p className="prose-serif text-sm leading-relaxed text-muted">
                    …retrieval found <span className="font-semibold text-text">4 passages</span>; every
                    claim links to <span className="font-semibold text-accent">doc#chunk</span>
                    <span className="ms-1 inline-block size-1.5 animate-pulse bg-warm align-middle" />
                  </p>
                </div>
              </div>
              <div className="absolute -bottom-6 -start-6 hidden xl:block">
                <div className="card-panel rotate-[2deg] px-4 py-3 shadow-soft">
                  <p className="flex items-center gap-2 font-mono text-xs text-muted">
                    <ShieldCheck className="size-3.5 text-warm" /> policy gate · deny-by-default
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pipeline ─────────────────────────────────────────────── */}
        <section id="pipeline" className="border-t border-line/70 bg-panel/50 py-16 sm:py-20">
          <div className="wrap">
            <p className="kicker">{t('pipelineKicker')}</p>
            <h2 className="display max-w-2xl text-[clamp(28px,3.6vw,40px)]">{t('pipelineTitle')}</h2>
            <p className="prose-serif mt-3 max-w-2xl text-[17px] text-muted">{t('pipelineDesc')}</p>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {pipeline.map((stage) => {
                const Icon = stage.icon
                return (
                  <li key={stage.key} className="flex flex-col gap-3 bg-paper p-6">
                    <span
                      className={`grid size-10 place-items-center rounded-xl ${
                        stage.key === 'policy' ? 'bg-warm/10 text-warm' : 'bg-accent/10 text-accent'
                      }`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <h3 className="text-[15px] font-semibold text-text">
                      {t(`stages.${stage.key}.name`)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted">{t(`stages.${stage.key}.desc`)}</p>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────── */}
        <section id="features" className="py-16 sm:py-20">
          <div className="wrap">
            <p className="kicker">{t('featuresKicker')}</p>
            <h2 className="display max-w-2xl text-[clamp(28px,3.6vw,40px)]">{t('featuresTitle')}</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => {
                const Icon = f.icon
                return (
                  <article key={f.key} className="card-paper group p-6 transition-shadow hover:shadow-lift">
                    <div className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-paper">
                        <Icon className="size-5" />
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                          f.live
                            ? 'border-[#c6ceb3] bg-[#e9efdd] text-[#4c5a3a]'
                            : 'border-line bg-panel text-faint'
                        }`}
                      >
                        {f.live ? tc('live') : tc('comingSoon')}
                      </span>
                    </div>
                    <h3 className="mt-4 text-[16px] font-semibold text-text">{t(`feat.${f.key}.name`)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{t(`feat.${f.key}.desc`)}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Roadmap ──────────────────────────────────────────────── */}
        <section id="roadmap" className="border-t border-line/70 bg-panel/50 py-16 sm:py-20">
          <div className="wrap">
            <p className="kicker">{t('roadmapKicker')}</p>
            <h2 className="display max-w-2xl text-[clamp(28px,3.6vw,40px)]">{t('roadmapTitle')}</h2>
            <p className="prose-serif mt-3 max-w-2xl text-[17px] text-muted">{t('roadmapDesc')}</p>

            <div className="mt-12 max-w-3xl">
              {phases.map((phase, i) => (
                <div key={phase.key} className="relative flex gap-5 pb-10 last:pb-0">
                  {i < phases.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute start-4 top-9 h-full w-px ${
                        phase.state === 'done' ? 'bg-accent/40' : 'bg-line'
                      }`}
                    />
                  )}
                  <span
                    className={`relative z-10 mt-1 grid size-8 shrink-0 place-items-center rounded-full border-2 ${
                      phase.state === 'done'
                        ? 'border-accent bg-accent text-paper'
                        : phase.state === 'active'
                          ? 'border-warm bg-paper text-warm'
                          : 'border-line bg-paper text-faint'
                    }`}
                  >
                    {phase.state === 'done' ? (
                      <CheckCircle2 className="size-4" />
                    ) : phase.state === 'active' ? (
                      <Hammer className="size-4" />
                    ) : (
                      <CircleDashed className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-[15.5px] font-semibold text-text">
                        {t(`phases.${phase.key}.title`)}
                      </h3>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                          phase.state === 'done'
                            ? 'bg-[#e9efdd] text-[#4c5a3a]'
                            : phase.state === 'active'
                              ? 'bg-warm/10 text-warm'
                              : 'bg-panel text-faint'
                        }`}
                      >
                        {phase.state === 'done'
                          ? t('statusDone')
                          : phase.state === 'active'
                            ? t('statusActive')
                            : t('statusNext')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {t(`phases.${phase.key}.desc`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────── */}
        <section className="py-16 sm:py-20">
          <div className="wrap">
            <div className="relative overflow-hidden rounded-3xl border border-line bg-[#e9efdd] px-8 py-14 text-center sm:px-14 sm:py-16">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(255,255,255,.5),transparent_55%)]"
              />
              <div className="relative">
                <h2 className="display text-[clamp(28px,4vw,44px)]">{t('ctaTitle')}</h2>
                <p className="prose-serif mx-auto mt-3 max-w-xl text-[17px] text-muted">{t('ctaDesc')}</p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/register"
                    className="group inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[15px] font-medium text-paper shadow-soft transition-colors hover:bg-accent-deep"
                  >
                    {t('createAccount')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-paper/70 px-6 py-3.5 text-[15px] font-medium text-text transition-colors hover:bg-paper"
                  >
                    {tc('signIn')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-line/70 py-10">
        <div className="wrap flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="flex items-center gap-2 text-sm text-muted">
            <ShieldCheck className="size-4 text-accent" />AegisAI
          </span>
          <span className="font-mono text-xs text-faint">
            FastAPI · Qdrant · Celery · LangGraph · llama.cpp
          </span>
        </div>
      </footer>
    </div>
  )
}
