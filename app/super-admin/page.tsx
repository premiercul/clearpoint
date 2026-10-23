// app/super-admin/page.tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import OverviewTab from '@/components/admin/OverviewTab'
import LinksTab from '@/components/admin/LinksTab'
import CreatorsTab from '@/components/admin/CreatorsTab'
import ReportsTab from '@/components/admin/ReportsTab'
import PromotionsTab from '@/components/admin/PromotionsTab'
import type { AdminOverview } from '@/lib/adminTypes'

type Tab = 'overview' | 'links' | 'creators' | 'reports' | 'promotions'

export default function SuperAdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const router = useRouter()
  const supabase = createClientComponentClient()

  const loadOverview = useCallback(async () => {
    // Authorisation happens in the database: every admin_* function checks profiles.is_admin.
    const { data, error } = await supabase.rpc('admin_overview')
    if (error || !data) {
      router.replace('/')
      return
    }
    setOverview(data as AdminOverview)
  }, [router, supabase])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  if (!overview) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gray-400">
        Verifying admin clearance...
      </div>
    )
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'links', label: 'Links' },
    { id: 'creators', label: 'Creators' },
    { id: 'reports', label: 'Reports', badge: overview.open_reports },
    { id: 'promotions', label: 'Promotions' },
  ]

  return (
    <main className="min-h-screen bg-gray-50 text-black p-4 sm:p-8">
      <div className="w-full space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-5 rounded-2xl border shadow-sm">
          <div>
            <h1 className="text-xl font-bold">ClearPoint Admin</h1>
            <p className="text-xs text-gray-500">Moderation, creators and sponsored banners.</p>
          </div>
          <Link href="/dashboard" className="text-xs text-gray-500 hover:underline">
            ← My dashboard
          </Link>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
                tab === t.id ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[10px] leading-none">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab o={overview} />}
        {tab === 'links' && <LinksTab />}
        {tab === 'creators' && <CreatorsTab />}
        {tab === 'reports' && <ReportsTab onChanged={loadOverview} />}
        {tab === 'promotions' && <PromotionsTab />}
      </div>
    </main>
  )
}
