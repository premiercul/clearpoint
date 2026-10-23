// components/admin/ReportsTab.tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { REASON_LABEL, type AdminReport, type ReportStatus } from '@/lib/adminTypes'

const FILTERS: { id: ReportStatus; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
]

export default function ReportsTab({ onChanged }: { onChanged?: () => void }) {
  const supabase = createClientComponentClient()
  const [status, setStatus] = useState<ReportStatus>('open')
  const [items, setItems] = useState<AdminReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    async (s: ReportStatus) => {
      setLoading(true)
      setError('')
      const { data, error } = await supabase.rpc('admin_list_reports', { p_status: s, p_limit: 100 })
      if (error) setError('Could not load reports.')
      else setItems((data || []) as AdminReport[])
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    load(status)
  }, [load, status])

  const resolve = async (r: AdminReport, next: ReportStatus) => {
    setBusy(r.id)
    const { error } = await supabase.rpc('admin_resolve_report', { p_id: r.id, p_status: next })
    setBusy(null)
    if (error) return setError('Could not update that report.')
    setItems((prev) => prev.filter((x) => x.id !== r.id))
    onChanged?.()
  }

  const takeDown = async (r: AdminReport) => {
    const note = window.prompt(`Take down "${r.link_title}"?\n\nReason shown to the creator (optional):`, '')
    if (note === null) return
    setBusy(r.id)
    const { error } = await supabase.rpc('admin_set_link_disabled', { p_id: r.link_id, p_disabled: true, p_note: note })
    setBusy(null)
    if (error) return setError('Could not take the link down.')
    // taking a link down resolves its open reports
    load(status)
    onChanged?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
              status === f.id ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-4 py-3">{error}</div>}

      {loading ? (
        <div className="p-12 text-center text-xs text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-xs text-gray-400">
          No {status} reports.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <Link href={`/pay/${r.link_id}`} target="_blank" rel="noreferrer" className="font-semibold text-sm hover:underline">
                    {r.link_title}
                  </Link>
                  <p className="text-[11px] text-gray-400">
                    {r.creator_email} · {r.submissions} submissions · reported {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-red-50 text-red-700 shrink-0">
                  {REASON_LABEL[r.reason]}
                </span>
              </div>

              {r.details && <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">{r.details}</p>}

              <div className="text-xs text-gray-600">
                <span className="text-gray-400">Pays into: </span>
                <span className="font-mono">{r.bank_details?.accountNumber}</span> · {r.bank_details?.accountName} ·{' '}
                {r.bank_details?.bankName}
              </div>
              <p className="text-[11px] text-gray-400">
                {r.reports_on_link} report{r.reports_on_link === 1 ? '' : 's'} on this link in total
                {r.link_disabled ? ' · already taken down' : ''}
              </p>

              {status === 'open' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {!r.link_disabled && (
                    <button
                      disabled={busy === r.id}
                      onClick={() => takeDown(r)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      Take link down
                    </button>
                  )}
                  <button
                    disabled={busy === r.id}
                    onClick={() => resolve(r, 'dismissed')}
                    className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <button
                    disabled={busy === r.id}
                    onClick={() => resolve(r, 'resolved')}
                    className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Mark resolved
                  </button>
                </div>
              )}
              {status !== 'open' && (
                <button
                  disabled={busy === r.id}
                  onClick={() => resolve(r, 'open')}
                  className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Reopen
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
