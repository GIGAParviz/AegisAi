'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterForm() {
  const router = useRouter()
  const { register: registerUser, isLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: RegisterFormData) => {
    setError(null)
    try {
      await registerUser(data)
      router.push('/en/dashboard')
      router.refresh()
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('409')) {
          setError('Email already registered')
        } else if (err.message.includes('429')) {
          setError('Too many requests. Please try again later.')
        } else {
          setError(err.message)
        }
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  const password = watch('password')

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md" padding="lg">
        <CardHeader className="text-center">
          <div className="text-3xl font-serif text-text italic mb-2">AegisAI</div>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>Start building your AI knowledge workspace</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-[rgb(255,240,240)] border border-warm/30 rounded-lg text-warm text-sm" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register('email')}
              type="email"
              label="Email"
              placeholder="you@example.com"
              error={errors.email?.message}
              autoComplete="email"
              disabled={isLoading}
            />
            <Input
              {...register('password')}
              type="password"
              label="Password"
              placeholder="••••••••"
              error={errors.password?.message}
              autoComplete="new-password"
              disabled={isLoading}
              hint="At least 8 characters"
            />
            <Input
              {...register('confirmPassword')}
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              autoComplete="new-password"
              disabled={isLoading}
            />
            <Button type="submit" className="w-full" size="lg" loading={isLoading}>
              Create account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-sm text-muted text-center">
            Already have an account?{' '}
            <Link href="/en/login" className="text-accent hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}