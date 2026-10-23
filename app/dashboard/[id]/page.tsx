// app/dashboard/[id]/page.tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import { exportToCSV } from '@/lib/exportUtils'
import { cacheSubmissions, readCachedSubmissions } from '@/lib/cache'
import { collectStoragePaths } from '@/lib/storagePaths'
import { getImageUrl, removeImages } from '@/lib/storage'
import { TEMPLATES } from '@/lib/templates'
import { amountOf, describePricing, findField, naira, orderSummary, resolvePricing } from '@/lib/pricing'
import {
  fieldValue,
  type Collection,
  type FormField,
  type Submission,
  type SubmissionStatus,
} from '@/lib/types'

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  verified: 'bg-green-50 text-green-700',
  flagged: 'bg-red-50 text-red-700',
}

type Tab = 'orders' | 'view'

const normId = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '')

export default function CollectionSubmissionsPage() {
  const params = useParams()
  const collectionId = params.id as string
  const supabase = createClientComponentClient()

  const [collection, setCollection] = useState<Collection | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)

  const [tab, setTab] = useState<Tab>('orders')
  const [onlyVerified, setOnlyVerified] = useState(false)
  const [dupesOnly, setDupesOnly] = useState(false)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewTitle, setPreviewTitle] = useState('Payment Receipt Proof')

  useEffect(() => {
    async function loadData() {
      const { data: colData } = await supabase.from('collections').select('*').eq('id', collectionId).maybeSingle()

      // RLS only returns collections you own
      if (!colData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setCollection(colData as Collection)

      const { data: subData, error: subError } = await supabase
        .from('submissions')
        .select('*')
        .eq('collection_id', collectionId)
        .order('submitted_at', { ascending: false })

      if (!subError && subData) {
        setSubmissions(subData as Submission[])
        cacheSubmissions(collectionId, subData)
      } else {
        const cached = readCachedSubmissions<Submission[]>(collectionId)
        if (cached) {
          setSubmissions(cached)
          setOffline(true)
        } else {
          setError('Could not load submissions. Check your network and refresh.')
        }
      }
      setLoading(false)
    }

    loadData()
  }, [collectionId, supabase])

  // ---------- derived data ----------
  const template = collection?.template ?? 'academic'
  const pricing = collection ? resolvePricing(collection) : null
  const fields: FormField[] = useMemo(() => collection?.custom_fields ?? [], [collection])
  const imageFields = fields.filter((f) => f.type === 'image')
  const dropField = fields.find((f) => f.type === 'select')
  const phoneField = fields.find((f) => f.type === 'tel')
  const nameField = findField(fields, /name/i)
  const idField = findField(fields, /matric|registration|reg\.?\s*(no|number)|student\s*id|\bid\b/i)
  const deptField = findField(fields, /department|faculty|class/i)

  const amt = (s: Submission) => (collection ? amountOf(s, collection) : 0)
  const sumOf = (list: Submission[]) => list.reduce((a, s) => a + amt(s), 0)
  const verified = submissions.filter((s) => s.status === 'verified')
  const pending = submissions.filter((s) => s.status === 'pending')
  const flagged = submissions.filter((s) => s.status === 'flagged')

  // Class reps: duplicate IDs (same student twice, or a fake entry)
  const dupeIds = useMemo(() => {
    if (!idField) return new Set<string>()
    const counts = new Map<string, number>()
    for (const s of submissions) {
      const v = normId(fieldValue(s, idField))
      if (v) counts.set(v, (counts.get(v) || 0) + 1)
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k))
  }, [submissions, idField])

  const isDupe = (s: Submission) => !!idField && dupeIds.has(normId(fieldValue(s, idField)))

  const filteredSubmissions = submissions.filter(
    (sub) =>
      JSON.stringify(sub.form_data).toLowerCase().includes(searchQuery.toLowerCase()) && (!dupesOnly || isDupe(sub))
  )

  // Older submissions (before receipts became a normal image field) keep their receipt in its own column
  const hasLegacyReceipts = submissions.some((s) => !!s.receipt_path)

  // ---------- actions ----------
  const patchSubmission = async (subId: string, patch: Partial<Pick<Submission, 'fulfilled' | 'status'>>) => {
    setError('')
    const previous = submissions
    const updated = submissions.map((s) => (s.id === subId ? { ...s, ...patch } : s))
    setSubmissions(updated)

    const { error } = await supabase.from('submissions').update(patch).eq('id', subId)
    if (error) {
      setSubmissions(previous) // roll back
      setError('Could not save that change. Please try again.')
      return
    }
    cacheSubmissions(collectionId, updated)
  }

  const openImage = async (path: string | null, title: string) => {
    setPreviewTitle(title)
    setPreviewOpen(true)
    setPreviewUrl(null)
    setPreviewError('')
    if (!path) {
      setPreviewError('This image is no longer available.')
      return
    }
    const url = await getImageUrl(supabase, path)
    if (!url) setPreviewError('Could not load the image. Please try again.')
    else setPreviewUrl(url)
  }

  const clearAllSubmissions = async () => {
    if (!window.confirm('Delete ALL submissions and images for this link? This cannot be undone.')) return
    setError('')
    const paths = collectStoragePaths(submissions, collection?.custom_fields || [])
    await removeImages(supabase, paths)
    const { error } = await supabase.from('submissions').delete().eq('collection_id', collectionId)
    if (error) {
      setError('Could not delete submissions. Please try again.')
      return
    }
    setSubmissions([])
    cacheSubmissions(collectionId, [])
  }

  const handleExport = (list: Submission[], suffix: string) => {
    if (!collection) return
    if (!exportToCSV(list, collection, suffix)) setError('No submissions available to export.')
  }

  const exportVerifiedSorted = () => {
    const list = [...verified]
    if (deptField) {
      list.sort((a, b) => fieldValue(a, deptField).localeCompare(fieldValue(b, deptField)))
    }
    handleExport(list, 'verified')
  }

  // ---------- small shared pieces ----------
  const imageButtons = (sub: Submission, compact = false) => (
    <span className="inline-flex flex-wrap gap-1.5">
      {imageFields.map((f) =>
        fieldValue(sub, f) ? (
          <button
            key={String(f.id)}
            onClick={() => openImage(fieldValue(sub, f), f.label)}
            className="no-print text-xs font-semibold text-blue-600 hover:underline bg-blue-50 px-2.5 py-1 rounded-lg"
          >
            {compact ? 'Receipt / photo' : 'View'}
          </button>
        ) : null
      )}
      {sub.receipt_path && (
        <button
          onClick={() => openImage(sub.receipt_path, 'Payment Receipt Proof')}
          className="no-print text-xs font-semibold text-blue-600 hover:underline bg-blue-50 px-2.5 py-1 rounded-lg"
        >
          Receipt
        </button>
      )}
    </span>
  )

  const statusSelect = (sub: Submission) => (
    <select
      value={sub.status}
      onChange={(e) => patchSubmission(sub.id, { status: e.target.value as SubmissionStatus })}
      aria-label="Verification status"
      className={`no-print text-[11px] font-semibold rounded-full px-2.5 py-1 border-0 ${STATUS_STYLE[sub.status]}`}
    >
      <option value="pending">Pending</option>
      <option value="verified">Verified</option>
      <option value="flagged">Flagged</option>
    </select>
  )

  const statCard = (label: string, value: string, sub?: string) => (
    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
      <p className="text-[11px] text-gray-500 uppercase font-medium">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )

  // ---------- delivery: run board ----------
  const boardOrders = submissions.filter(
    (s) => !s.fulfilled && s.status !== 'flagged' && (!onlyVerified || s.status === 'verified')
  )
  const boardGroups = useMemo(() => {
    const map = new Map<string, Submission[]>()
    for (const s of boardOrders) {
      const key = dropField ? fieldValue(s, dropField) || 'No drop-off point' : 'All orders'
      map.set(key, [...(map.get(key) || []), s])
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, onlyVerified, dropField])
  const itemsToBuy = boardOrders.reduce((a, s) => a + (s.item_cost || 0), 0)
  const deliveryFee = pricing?.mode === 'delivery' ? pricing.fee : 0
  const deliveredCount = submissions.filter((s) => s.fulfilled).length

  // ---------- vendor: pick list ----------
  const pickOrders = submissions.filter((s) => s.status !== 'flagged' && (!onlyVerified || s.status === 'verified'))
  const pickRows =
    pricing?.mode === 'items'
      ? pricing.items
          .map((it) => {
            const qty = pickOrders.reduce((a, s) => a + (s.order_items?.[it.id] || 0), 0)
            return { ...it, qty, revenue: qty * it.price }
          })
          .filter((r) => r.qty > 0)
          .sort((a, b) => b.qty - a.qty)
      : []
  const pickPoints = useMemo(() => {
    if (!dropField) return [] as [string, number][]
    const map = new Map<string, number>()
    for (const s of pickOrders) {
      const k = fieldValue(s, dropField) || 'No pickup point'
      map.set(k, (map.get(k) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, onlyVerified, dropField])

  const viewTabLabel = template === 'delivery' ? 'Run board' : template === 'vendor_social' ? 'Pick list' : null
  const doneLabel = template === 'delivery' ? 'Delivered' : template === 'vendor_social' ? 'Handed over' : 'Fulfilled / Delivered'

  if (notFound) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-center px-4">
        <h1 className="text-lg font-bold">Collection not found</h1>
        <Link href="/dashboard" className="text-xs text-gray-500 hover:underline">
          ← Back to Dashboard
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 text-black p-4 sm:p-8">
      <div className="w-full space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <Link href="/dashboard" className="text-xs text-gray-500 hover:underline">
            ← Back to Dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExport(submissions, 'submissions')}
              className="px-3 py-2 bg-white border border-gray-200 text-black rounded-xl text-xs font-medium hover:bg-gray-50"
            >
              Export CSV
            </button>
            {template === 'academic' && (
              <button
                onClick={exportVerifiedSorted}
                className="px-3 py-2 bg-white border border-gray-200 text-black rounded-xl text-xs font-medium hover:bg-gray-50"
              >
                Export verified{deptField ? ' (by department)' : ''}
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="px-3 py-2 bg-black text-white rounded-xl text-xs font-medium hover:bg-gray-800"
            >
              Print / Save PDF
            </button>
          </div>
        </div>

        {error && (
          <div className="no-print bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-4 py-3">{error}</div>
        )}
        {offline && (
          <div className="no-print bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-xl px-4 py-3">
            You&apos;re offline — showing the last copy loaded in this tab.
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
          <div>
            <h1 className="text-xl font-bold">{collection?.title}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {describePricing(pricing)}
              {collection?.closes_at ? ` • Closes ${new Date(collection.closes_at).toLocaleString()}` : ''}
            </p>
          </div>
          <input
            type="text"
            placeholder={TEMPLATES[template].copy.searchHint}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="no-print px-3 py-2 text-sm border rounded-xl w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* Money at a glance */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCard(TEMPLATES[template].copy.unitPlural.replace(/^./, (c) => c.toUpperCase()), String(submissions.length))}
          {statCard("Verified", naira(sumOf(verified)), `${verified.length} verified`)}
          {statCard("Pending check", naira(sumOf(pending)), `${pending.length} waiting`)}
          {statCard("Flagged", String(flagged.length), flagged.length ? 'Not counted in totals' : undefined)}
        </div>

        {/* Tabs (delivery + vendor get a second view) */}
        {viewTabLabel && (
          <div className="no-print flex items-center gap-2">
            {(['orders', 'view'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border ${
                  tab === t ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t === 'orders' ? 'All orders' : viewTabLabel}
              </button>
            ))}
            {tab === 'view' && (
              <label className="ml-auto flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} />
                Verified only
              </label>
            )}
          </div>
        )}

        {/* ---------- ORDERS TABLE ---------- */}
        {(tab === 'orders' || !viewTabLabel) && (
          <>
            {template === 'academic' && dupeIds.size > 0 && (
              <div className="bg-amber-50 border border-amber-100 text-amber-900 text-xs rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
                <span>
                  {dupeIds.size} {idField?.label || 'ID'}
                  {dupeIds.size === 1 ? ' appears' : 's appear'} more than once: the same student twice, or a fake entry.
                </span>
                <button
                  onClick={() => setDupesOnly((v) => !v)}
                  className="no-print font-semibold underline"
                >
                  {dupesOnly ? 'Show everyone' : 'Show duplicates only'}
                </button>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {loading ? (
                <div className="p-12 text-center text-xs text-gray-400">Loading submissions...</div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400">
                  {submissions.length === 0 ? 'No submissions yet.' : 'No submissions found matching your search.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="p-4 font-semibold">Time</th>
                        {fields.map((f) => (
                          <th key={f.id} className="p-4 font-semibold">
                            {f.label}
                          </th>
                        ))}
                        {pricing?.mode === 'items' && <th className="p-4 font-semibold">Order</th>}
                        {pricing?.mode === 'delivery' && <th className="p-4 font-semibold">Item cost</th>}
                        <th className="p-4 font-semibold">Expected</th>
                        {hasLegacyReceipts && <th className="no-print p-4 font-semibold">Receipt Proof</th>}
                        <th className="p-4 font-semibold">Status</th>
                        <th className="p-4 font-semibold">{doneLabel}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {filteredSubmissions.map((sub) => (
                        <tr key={sub.id} className={`hover:bg-gray-50 transition-colors ${isDupe(sub) ? 'bg-amber-50/50' : ''}`}>
                          <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                            {new Date(sub.submitted_at).toLocaleDateString()}{' '}
                            {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          {fields.map((f) => (
                            <td key={f.id} className="p-4 font-medium text-gray-900">
                              {f.type === 'image' ? (
                                fieldValue(sub, f) ? (
                                  <button
                                    onClick={() => openImage(fieldValue(sub, f), f.label)}
                                    className="no-print text-xs font-semibold text-blue-600 hover:underline bg-blue-50 px-2.5 py-1 rounded-lg"
                                  >
                                    View
                                  </button>
                                ) : (
                                  '-'
                                )
                              ) : (
                                fieldValue(sub, f) || '-'
                              )}
                            </td>
                          ))}
                          {pricing?.mode === 'items' && (
                            <td className="p-4 text-xs text-gray-700">{orderSummary(sub, pricing) || '-'}</td>
                          )}
                          {pricing?.mode === 'delivery' && (
                            <td className="p-4 text-xs text-gray-700">
                              {sub.item_cost !== null && sub.item_cost !== undefined ? naira(sub.item_cost) : '-'}
                            </td>
                          )}
                          <td className="p-4 text-xs font-semibold whitespace-nowrap">{naira(amt(sub))}</td>
                          {hasLegacyReceipts && (
                            <td className="no-print p-4">
                              {sub.receipt_path ? (
                                <button
                                  onClick={() => openImage(sub.receipt_path, 'Payment Receipt Proof')}
                                  className="text-xs font-semibold text-blue-600 hover:underline bg-blue-50 px-2.5 py-1 rounded-lg"
                                >
                                  View Receipt
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
                          )}
                          <td className="p-4">
                            {statusSelect(sub)}
                            <span className="hidden print:inline text-xs capitalize">{sub.status}</span>
                          </td>
                          <td className="p-4">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={sub.fulfilled || false}
                                onChange={() => patchSubmission(sub.id, { fulfilled: !sub.fulfilled })}
                                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                              />
                              <span className={`text-xs font-medium ${sub.fulfilled ? 'text-green-600' : 'text-gray-500'}`}>
                                {sub.fulfilled ? 'Done' : 'Pending'}
                              </span>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ---------- DELIVERY: RUN BOARD ---------- */}
        {tab === 'view' && template === 'delivery' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {statCard("Orders to deliver", String(boardOrders.length), `${deliveredCount} delivered so far`)}
              {statCard("Items to buy", naira(itemsToBuy), "Sum of item costs")}
              {statCard("Your fees", naira(boardOrders.length * deliveryFee), "For these orders")}
              {statCard("Drop-off stops", String(boardGroups.length))}
            </div>

            {boardGroups.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-xs text-gray-400">
                Nothing left to deliver.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {boardGroups.map(([stop, orders]) => (
                  <div key={stop} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-semibold text-sm">{stop}</h3>
                      <span className="text-[11px] text-gray-500">
                        {orders.length} order{orders.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {orders.map((o) => (
                        <div key={o.id} className="p-4 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-sm font-semibold">{nameField ? fieldValue(o, nameField) : 'Order'}</p>
                              {phoneField && fieldValue(o, phoneField) && (
                                <a
                                  href={`tel:${fieldValue(o, phoneField).replace(/\s/g, '')}`}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  {fieldValue(o, phoneField)}
                                </a>
                              )}
                            </div>
                            {statusSelect(o)}
                          </div>
                          <div className="text-xs text-gray-700 space-y-0.5">
                            {fields
                              .filter(
                                (f) =>
                                  f.type !== 'image' &&
                                  f.id !== nameField?.id &&
                                  f.id !== phoneField?.id &&
                                  f.id !== dropField?.id &&
                                  fieldValue(o, f)
                              )
                              .map((f) => (
                                <p key={String(f.id)}>
                                  <span className="text-gray-400">{f.label}: </span>
                                  {fieldValue(o, f)}
                                </p>
                              ))}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <p className="text-xs">
                              Items {naira(o.item_cost || 0)} · Total <span className="font-semibold">{naira(amt(o))}</span>
                            </p>
                            <div className="flex items-center gap-2">
                              {imageButtons(o, true)}
                              <button
                                onClick={() => patchSubmission(o.id, { fulfilled: true })}
                                className="no-print px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-gray-800"
                              >
                                Mark delivered
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------- VENDOR: PICK LIST ---------- */}
        {tab === 'view' && template === 'vendor_social' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {statCard("Orders counted", String(pickOrders.length), onlyVerified ? 'Verified only' : 'Excludes flagged')}
              {statCard("Revenue", naira(sumOf(pickOrders)))}
              {statCard("Items to prepare", String(pickRows.reduce((a, r) => a + r.qty, 0)))}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-sm">Pick list</h3>
              </div>
              {pickRows.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400">No items ordered yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wider border-b">
                        <th className="p-4 font-semibold">Item</th>
                        <th className="p-4 font-semibold">Quantity</th>
                        <th className="p-4 font-semibold">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pickRows.map((r) => (
                        <tr key={r.id}>
                          <td className="p-4 font-medium">{r.name}</td>
                          <td className="p-4 text-lg font-bold">{r.qty}</td>
                          <td className="p-4 text-xs">{naira(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {pickPoints.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-2">
                <h3 className="font-semibold text-sm">Orders by {dropField?.label || 'pickup point'}</h3>
                <div className="flex flex-wrap gap-2">
                  {pickPoints.map(([k, n]) => (
                    <span key={k} className="text-xs bg-gray-100 rounded-full px-3 py-1">
                      {k}: <span className="font-semibold">{n}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {submissions.length > 0 && (
          <div className="no-print flex justify-end">
            <button onClick={clearAllSubmissions} className="text-xs text-red-600 hover:underline font-medium">
              Delete all submissions &amp; images
            </button>
          </div>
        )}
      </div>

      {previewOpen && (
        <div className="no-print fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-xl relative">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">{previewTitle}</h3>
              <button
                onClick={() => setPreviewOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-black text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="w-full h-96 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border">
              {previewError ? (
                <p className="text-xs text-red-600 px-4 text-center">{previewError}</p>
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={previewTitle} className="object-contain w-full h-full" />
              ) : (
                <p className="text-xs text-gray-400">Loading image...</p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-2 bg-black text-white text-xs rounded-xl font-medium"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
