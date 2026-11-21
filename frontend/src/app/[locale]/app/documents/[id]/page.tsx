import { redirect } from 'next/navigation'
export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) { const { locale, id } = await params; redirect(`/${locale}/app/chat?doc=${encodeURIComponent(id)}`) }
