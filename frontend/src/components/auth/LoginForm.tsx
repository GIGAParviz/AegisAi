'use client'

import { useTranslations } from 'next-intl'
import { clsx } from 'clsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Link, useRouter } from '@/lib/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const loginSchema = z.object({
  email: z.string().email('invalid_email'),
  password: z.string().min(1, 'password_required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const { login } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const mapError = (code: string) =>
    code === 'invalid_email' ? t('invalidEmail') : t('passwordRequired')

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    setSubmitting(true)
    try {
      await login(data.email, data.password)
      router.push('/app/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('401')) setError(t('invalidEmailOrPassword'))
      else if (message.includes('429')) setError(t('tooManyRequests'))
      else setError(t('unexpectedError'))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t('backHome')}
      </Link>

      <h1 className="display text-4xl">{t('welcomeBack')}</h1>
      <p className="prose-serif mt-2 text-[16.5px] text-muted">{t('signInSubtitle')}</p>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-warm/30 bg-[#f3e2e8] px-4 py-3 text-sm text-warm"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <Input
          {...register('email')}
          type="email"
          label={t('email')}
          placeholder="you@example.com"
          error={errors.email?.message ? mapError(errors.email.message) : undefined}
          autoComplete="email"
          disabled={submitting}
          className="!bg-paper"
        />
        <Input
          {...register('password')}
          type="password"
          label={t('password')}
          placeholder="••••••••"
          error={errors.password?.message ? mapError(errors.password.message) : undefined}
          autoComplete="current-password"
          disabled={submitting}
          className="!bg-paper"
        />
        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          {t('signIn')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-accent hover:underline">
          {t('signUp')}
        </Link>
      </p>
    </div>
  )
}

export function AuthSplit({ children }: { children: React.ReactNode }) {
  const t = useTranslations('landing')
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Quote side — desktop only */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-e border-line bg-panel/60 p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-paper">
            <ShieldCheck className="size-4.5" />
          </span>
          <span className="display text-[22px] leading-none">AegisAI</span>
        </Link>

        <div className="relative z-10 max-w-md">
          <p className="display text-4xl leading-[1.15]">
            {t('heroLine1')}{' '}
            <span className="text-accent">{t('heroLine2')}</span>
          </p>
          <p className="prose-serif mt-5 text-[16.5px] leading-relaxed text-muted">{t('subtitle')}</p>
        </div>

        <ul className="relative z-10 grid grid-cols-3 gap-3">
          {(
            [
              { k: 'ingest', icon: '📄' },
              { k: 'chat', icon: '💬' },
              { k: 'local', icon: '🖥' },
            ] as const
          ).map((f) => (
            <li key={f.k} className={clsx('card-paper px-3 py-3 text-center')}>
              <span className="text-lg">{f.icon}</span>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                {t(`feat.${f.k}.name`)}
              </p>
            </li>
          ))}
        </ul>

        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-72 bg-[radial-gradient(ellipse_at_20%_100%,rgba(118,124,76,0.16),transparent_60%)]"
        />
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full">{children}</div>
      </div>
    </div>
  )
}
