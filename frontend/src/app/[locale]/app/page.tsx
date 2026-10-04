import { redirect } from 'next/navigation'

export default async function AppIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // The workspace landing is the dashboard; keep /{locale}/app as a stable
  // link target by redirecting inside the active locale.
  const { locale } = await params
  redirect(`/${locale}/app/dashboard`)
}
