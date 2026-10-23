// components/admin/CreatorsTab.tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { TEMPLATES } from '@/lib/templates'
import type { AdminCreator } from '@/lib/adminTypes'

const PAGE = 25

export default function CreatorsTab() {
  const supabase = createClientComponentClient()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<AdminCreator[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    async (reset: boolean, q: string, offset: number) => {
      setLoading(true)
      setError('')
      const { data, error } = await supabase.rpc('admin_list_creators', { p_search: q, p_limit: PAGE, p_offset: offset })
      if (error) {
        setError('Could not load creators.')
        setLoading(false)
        return
      }
      const rows = (data || []) as AdminCreator[]
      setItems((prev) => (reset ? rows : [...prev, ...rows]))
      setHasMore(rows.length === PAGE)
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    load(true, '', 0)
  }, [load])

  const setSuspended = async (c: AdminCreator, suspend: boolean) => {
    let note: string | null = null
    if (suspend) {
      note = window.prompt(
        `Suspend ${c.email || 'this creator'}?\nAll their links will be taken down and they can't create new ones.\n\nReason (optional):`,
        ''
      )
      if (note === null) return
    } else if (!window.confirm(`Lift the suspension for ${c.email || 'this creator'}? Links closed by the suspension reopen.`)) {
      return
    }
    setBusy(c.id)
    const { error } = await supabase.rpc('admin_set_creator_suspended', { p_id: c.id, p_suspended: suspend, p_note: note })
    setBusy(null)
    if (error) return setError('Could not update this creator.')
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, suspended: suspend } : x)))
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
          placeholder="Search by email or name"
          className="flex-1 px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button type="submit" className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-xl">
          Search
        </button>
      </form>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-4 py-3">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {items.length === 0 && !loading ? (
          <div className="p-12 text-center text-xs text-gray-400">No creators found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[680px]">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b">
                  <th className="p-3 font-semibold">Creator</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Joined</th>
                  <th className="p-3 font-semibold">Links</th>
                  <th className="p-3 font-semibold">Submissions</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((c) => (
                  <tr key={c.id}>
                    <td className="p-3 text-xs">
                      <p className="font-semibold">{c.email || '-'}</p>
                      <p className="text-gray-400">{c.full_name}</p>
                    </td>
                    <td className="p-3 text-xs">{c.account_type ? TEMPLATES[c.account_type]?.label : 'Not chosen yet'}</td>
                    <td className="p-3 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-xs">{c.links}</td>
                    <td className="p-3 text-xs">{c.submissions}</td>
                    <td className="p-3">
                      {c.is_admin ? (
                        <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-black text-white">Admin</span>
                      ) : c.suspended ? (
                        <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-red-50 text-red-700">Suspended</span>
                      ) : (
                        <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 bg-green-50 text-green-700">Active</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {!c.is_admin && (
                        <button
                          disabled={busy === c.id}
                          onClick={() => setSuspended(c, !c.suspended)}
                          className={`px-3 py-1.5 border rounded-lg text-xs font-medium disabled:opacity-50 ${
                            c.suspended ? 'hover:bg-gray-50' : 'border-red-200 text-red-600 hover:bg-red-50'
                          }`}
                        >
                          {c.suspended ? 'Lift suspension' : 'Suspend'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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
