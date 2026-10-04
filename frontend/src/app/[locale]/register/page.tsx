import type { Metadata } from 'next'
import { AuthSplit } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = { title: 'Create account' }

export default function RegisterPage() {
  return <AuthSplit><RegisterForm /></AuthSplit>
}
