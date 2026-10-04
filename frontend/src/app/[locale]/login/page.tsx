import type { Metadata } from 'next'
import { AuthSplit, LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage() {
  return <AuthSplit><LoginForm /></AuthSplit>
}
