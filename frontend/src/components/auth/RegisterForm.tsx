'use client'

import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Link, useRouter } from '@/lib/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const registerSchema = z
  .object({
    email: z.string().email('invalid_email'),
    password: z.string().min(8, 'password_hint'),
    confirmPassword: z.string().min(1, 'password_required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwords_differ',
    path: ['confirmPassword'],
  })

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const { register: registerUser } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  const mapError = (code?: string) => {
    switch (code) {
      case 'invalid_email':
        return t('invalidEmail')
      case 'password_hint':
        return t('passwordHint')
      case 'password_required':
        return t('passwordRequired')
      case 'passwords_differ':
        return t('passwordsDiffer')
      default:
        return code ?? t('unexpectedError')
    }
  }

  const onSubmit = async (data: RegisterFormData) => {
    setError(null)
    setSubmitting(true)
    try {
      await registerUser(data.email, data.password)
      router.push('/app/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('409')) setError(t('emailTaken'))
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

      <h1 className="display text-4xl">{t('createAccount')}</h1>
      <p className="prose-serif mt-2 text-[16.5px] text-muted">{t('registerSubtitle')}</p>

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
          hint={!errors.password ? t('passwordHint') : undefined}
          autoComplete="new-password"
          disabled={submitting}
          className="!bg-paper"
        />
        <Input
          {...register('confirmPassword')}
          type="password"
          label={t('confirmPassword')}
          placeholder="••••••••"
          error={errors.confirmPassword?.message ? mapError(errors.confirmPassword.message) : undefined}
          autoComplete="new-password"
          disabled={submitting}
          className="!bg-paper"
        />
        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          {t('signUp')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </div>
  )
}
