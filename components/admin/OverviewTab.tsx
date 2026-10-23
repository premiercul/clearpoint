// components/admin/OverviewTab.tsx
'use client'
import { naira } from '@/lib/pricing'
import { TEMPLATES } from '@/lib/templates'
import type { AdminOverview } from '@/lib/adminTypes'
import type { Template } from '@/lib/types'

// Supabase free plan file storage (check your plan; change this if you upgrade)
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  return `${Math.round(hrs / 24)} days ago`
}

const mb = (b: number) => (b / (1024 * 1024)).toFixed(b > 100 * 1024 * 1024 ? 0 : 1)

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' }) {
  return (
    <div className={`bg-white p-5 rounded-2xl border shadow-sm ${tone === 'warn' ? 'border-red-200' : 'border-gray-200'}`}>
      <p className="text-[11px] text-gray-500 uppercase font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function OverviewTab({ o }: { o: AdminOverview }) {
  const types = (Object.keys(TEMPLATES) as Template[]).map((t) => ({ t, n: Number(o.links_by_template?.[t] || 0) }))
  const maxType = Math.max(1, ...types.map((x) => x.n))
  const maxDay = Math.max(1, ...o.daily.map((d) => d.n))
  const storagePct = Math.min(100, (o.storage_bytes / STORAGE_LIMIT_BYTES) * 100)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Creators" value={Number(o.users).toLocaleString()} sub={`${o.new_creators_7d} new this week`} />
        <Card
          label="Live links"
          value={Number(o.active_links).toLocaleString()}
          sub={`of ${o.links} created${o.disabled_links ? ` · ${o.disabled_links} taken down` : ''}`}
        />
        <Card label="Submissions" value={Number(o.submissions).toLocaleString()} sub={`${o.submissions_7d} this week`} />
        <Card
          label="Open reports"
          value={String(o.open_reports)}
          sub={o.open_reports ? 'Needs review' : 'All clear'}
          tone={o.open_reports ? 'warn' : undefined}
        />
        <Card
          label="Payer visits (7 days)"
          value={Number(o.payer_views_7d).toLocaleString()}
          sub={
            o.payer_views_7d > 0
              ? `${((o.submissions_7d / o.payer_views_7d) * 100).toFixed(0)} submissions per 100 visits`
              : 'No visits yet'
          }
        />
        <Card
          label="Keep-alive ping"
          value={ago(o.last_keepalive)}
          sub={
            !o.last_keepalive
              ? 'Not set up yet: free projects pause after a week of quiet'
              : Date.now() - new Date(o.last_keepalive).getTime() > 2 * 24 * 3600 * 1000
              ? 'Stale: check the scheduled ping'
              : 'Project is being kept awake'
          }
          tone={!o.last_keepalive || Date.now() - new Date(o.last_keepalive).getTime() > 2 * 24 * 3600 * 1000 ? 'warn' : undefined}
        />
        <Card label="Creator-verified volume" value={naira(o.verified_volume)} sub="Totals creators marked verified" />
        <Card label="Waiting to be checked" value={naira(o.pending_volume)} sub="Not yet verified by creators" />
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm col-span-2">
          <p className="text-[11px] text-gray-500 uppercase font-medium">Storage used</p>
          <p className="text-2xl font-bold mt-1">
            {mb(o.storage_bytes)} MB <span className="text-sm font-medium text-gray-400">of {mb(STORAGE_LIMIT_BYTES)} MB (free plan)</span>
          </p>
          <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full ${storagePct > 80 ? 'bg-red-500' : 'bg-black'}`}
              style={{ width: `${storagePct}%` }}
            />
          </div>
          {storagePct > 80 && <p className="text-[11px] text-red-600 mt-1">Getting full: time to upgrade or move storage.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <h3 className="font-semibold text-sm">Links by type</h3>
          {types.map(({ t, n }) => (
            <div key={t} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{TEMPLATES[t].label}</span>
                <span className="font-semibold">{n}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-black" style={{ width: `${(n / maxType) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <h3 className="font-semibold text-sm">Submissions per day (last 14 days)</h3>
          <div className="flex items-end gap-1 h-28" role="img" aria-label="Submissions per day">
            {o.daily.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col justify-end h-full" title={`${d.day}: ${d.n}`}>
                <div className="bg-black rounded-t" style={{ height: `${Math.max(3, (d.n / maxDay) * 100)}%`, opacity: d.n ? 1 : 0.15 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>{o.daily[0]?.day}</span>
            <span>{o.daily[o.daily.length - 1]?.day}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
