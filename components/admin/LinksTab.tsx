// components/admin/LinksTab.tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { removeImages } from '@/lib/storage'
import { TEMPLATES } from '@/lib/templates'
import type { AdminLink } from '@/lib/adminTypes'

const PAGE = 25

export default function LinksTab() {
  const supabase = createClientComponentClient()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<AdminLink[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    async (reset: boolean, q: string, offset: number) => {
      setLoading(true)
      setError('')
      const { data, error } = await supabase.rpc('admin_list_links', { p_search: q, p_limit: PAGE, p_offset: offset })
      if (error) {
        setError('Could not load links.')
        setLoading(false)
        return
      }
      const rows = (data || []) as AdminLink[]
      setItems((prev) => (reset ? rows : [...prev, ...rows]))
      setHasMore(rows.length === PAGE)
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    load(true, '', 0)
  }, [load])

  const takeDown = async (l: AdminLink) => {
    const note = window.prompt(`Take down "${l.title}"?\n\nReason shown to the creator (optional):`, '')
    if (note === null) return
    setBusy(l.id)
    const { error } = await supabase.rpc('admin_set_link_disabled', { p_id: l.id, p_disabled: true, p_note: note })
    setBusy(null)
    if (error) return setError('Could not take the link down.')
    setItems((prev) =>
      prev.map((x) => (x.id === l.id ? { ...x, admin_disabled: true, admin_note: note.trim() || null, open_reports: 0 } : x))
    )
  }

  const restore = async (l: AdminLink) => {
    setBusy(l.id)
    const { error } = await supabase.rpc('admin_set_link_disabled', { p_id: l.id, p_disabled: false, p_note: null })
    setBusy(null)
    if (error) return setError('Could not restore the link.')
    setItems((prev) => prev.map((x) => (x.id === l.id ? { ...x, admin_disabled: false, admin_note: null } : x)))
  }

  const remove = async (l: AdminLink) => {
    if (
      !window.confirm(
        `Permanently delete "${l.title}", its ${l.submissions} submission(s) and all uploaded images? This cannot be undone.`
      )
    )
      return
    setBusy(l.id)
    const { data: paths } = await supabase.rpc('admin_link_image_paths', { p_id: l.id })
    await removeImages(supabase, (paths || []) as string[])
    const { error } = await supabase.rpc('admin_delete_link', { p_id: l.id })
    setBusy(null)
    if (error) return setError('Could not delete the link.')
    setItems((prev) => prev.filter((x) => x.id !== l.id))
  }

  const status = (l: AdminLink) => {
    if (l.admin_disabled) return { text: 'Taken down', cls: 'bg-red-50 text-red-700' }
    const expired = !!l.closes_at && new Date(l.closes_at).getTime() <= Date.now()
    if (!l.is_active || expired) return { text: 'Closed', cls: 'bg-amber-50 text-amber-700' }
    return { text: 'Open', cls: 'bg-green-50 text-green-700' }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          load(true, search, 0)
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, creator email, account number or account name"
          className="flex-1 px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button type="submit" className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-xl">
          Search
        </button>
      </form>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-4 py-3">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {items.length === 0 && !loading ? (
          <div className="p-12 text-center text-xs text-gray-400">No links found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[820px]">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b">
                  <th className="p-3 font-semibold">Link</th>
                  <th className="p-3 font-semibold">Creator</th>
                  <th className="p-3 font-semibold">Pays into</th>
                  <th className="p-3 font-semibold">Activity</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((l) => {
                  const st = status(l)
                  return (
                    <tr key={l.id} className={l.open_reports > 0 ? 'bg-red-50/40' : ''}>
                      <td className="p-3">
                        <Link href={`/pay/${l.id}`} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
                          {l.title}
                        </Link>
                        <p className="text-[11px] text-gray-400">
                          {TEMPLATES[l.template]?.label} · {new Date(l.created_at).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="p-3 text-xs">
                        <p>{l.creator_email || '-'}</p>
                        <p className="text-gray-400">{l.creator_name}</p>
                      </td>
                      <td className="p-3 text-xs">
                        <p className="font-mono">{l.bank_details?.accountNumber}</p>
                        <p className="text-gray-500">
                          {l.bank_details?.accountName} · {l.bank_details?.bankName}
                        </p>
                      </td>
                      <td className="p-3 text-xs">
                        <p>{l.submissions} submissions</p>
                        {l.open_reports > 0 && <p className="font-semibold text-red-600">{l.open_reports} open report(s)</p>}
                      </td>
                      <td className="p-3">
                        <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 ${st.cls}`}>{st.text}</span>
                        {l.admin_note && <p className="text-[11px] text-gray-400 mt-1 max-w-[160px]">{l.admin_note}</p>}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          {l.admin_disabled ? (
                            <button
                              disabled={busy === l.id}
                              onClick={() => restore(l)}
                              className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              disabled={busy === l.id}
                              onClick={() => takeDown(l)}
                              className="px-3 py-1.5 border border-amber-300 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-50 disabled:opacity-50"
                            >
                              Take down
                            </button>
                          )}
                          <button
                            disabled={busy === l.id}
                            onClick={() => remove(l)}
                            className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {loading && <div className="p-4 text-center text-xs text-gray-400">Loading...</div>}
      </div>

      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={() => load(false, search, items.length)}
            className="px-4 py-2 border rounded-xl text-xs font-medium hover:bg-gray-50"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
