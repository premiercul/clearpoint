// components/admin/PromotionsTab.tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { compressBanner } from '@/lib/image'
import { uuid } from '@/lib/fields'
import type { AdminPromotion, PromoPlacement } from '@/lib/adminTypes'

const PLACEMENT_LABEL: Record<PromoPlacement, string> = {
  dashboard: 'Creator dashboard',
  landing: 'Landing page',
  both: 'Dashboard + landing page',
  payer_success: 'Payer confirmation screen',
  everywhere: 'All three places',
}

const inputCls = 'w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-black'

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PromotionsTab() {
  const supabase = createClientComponentClient()
  const [items, setItems] = useState<AdminPromotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // form
  const [title, setTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [placement, setPlacement] = useState<PromoPlacement>('both')
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()))
  const [endsAt, setEndsAt] = useState('')
  const [live, setLive] = useState(true)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)

  const publicUrl = useCallback(
    (path: string) => supabase.storage.from('promotions').getPublicUrl(path).data.publicUrl,
    [supabase]
  )

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_promotions')
    if (error) setError('Could not load promotions.')
    else setItems((data || []) as AdminPromotion[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const pickImage = async (file: File | null) => {
    setError('')
    setBlob(null)
    setPreview('')
    if (!file) return
    try {
      const b = await compressBanner(file)
      setBlob(b)
      setPreview(URL.createObjectURL(b))
    } catch {
      setError('Could not read that image. Use a JPG, PNG or WebP.')
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    let url: URL
    try {
      url = new URL(linkUrl.trim())
    } catch {
      return setError('Enter a full link, e.g. https://example.com')
    }
    if (url.protocol !== 'https:') return setError('The link must start with https://')
    if (!title.trim()) return setError('Add the sponsor or campaign name.')
    if (!blob) return setError('Choose a banner image.')
    const starts = new Date(startsAt)
    const ends = endsAt ? new Date(endsAt) : null
    if (Number.isNaN(starts.getTime())) return setError('Check the start time.')
    if (ends && (Number.isNaN(ends.getTime()) || ends <= starts)) return setError('The end must be after the start.')

    setSaving(true)
    const path = `${uuid()}.jpg`
    const { error: upErr } = await supabase.storage
      .from('promotions')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (upErr) {
      setSaving(false)
      return setError('Image upload failed. Please try again.')
    }
    const { error: rpcErr } = await supabase.rpc('admin_create_promotion', {
      p_title: title.trim(),
      p_image_path: path,
      p_link_url: url.toString(),
      p_placement: placement,
      p_starts_at: starts.toISOString(),
      p_ends_at: ends ? ends.toISOString() : null,
      p_is_active: live,
    })
    if (rpcErr) {
      await supabase.storage.from('promotions').remove([path])
      setSaving(false)
      return setError('Could not save the promotion.')
    }
    setSaving(false)
    setMessage('Promotion saved.')
    setTitle('')
    setLinkUrl('')
    setEndsAt('')
    setBlob(null)
    setPreview('')
    load()
  }

  const toggle = async (p: AdminPromotion) => {
    setBusy(p.id)
    const { error } = await supabase.rpc('admin_set_promotion_active', { p_id: p.id, p_active: !p.is_active })
    setBusy(null)
    if (error) return setError('Could not update the promotion.')
    setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)))
  }

  const remove = async (p: AdminPromotion) => {
    if (!window.confirm(`Delete "${p.title}" and its image?`)) return
    setBusy(p.id)
    const { data, error } = await supabase.rpc('admin_delete_promotion', { p_id: p.id })
    if (!error && data) await supabase.storage.from('promotions').remove([data as string])
    setBusy(null)
    if (error) return setError('Could not delete the promotion.')
    setItems((prev) => prev.filter((x) => x.id !== p.id))
  }

  const state = (p: AdminPromotion) => {
    const now = Date.now()
    if (!p.is_active) return { text: 'Paused', cls: 'bg-gray-100 text-gray-700' }
    if (new Date(p.starts_at).getTime() > now) return { text: 'Scheduled', cls: 'bg-blue-50 text-blue-700' }
    if (p.ends_at && new Date(p.ends_at).getTime() <= now) return { text: 'Ended', cls: 'bg-amber-50 text-amber-700' }
    return { text: 'Live', cls: 'bg-green-50 text-green-700' }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 items-start">
      {/* New promotion */}
      <form onSubmit={save} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-sm">New sponsored banner</h3>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Sponsor / campaign name *</label>
          <input className={inputCls} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Campus Bites" />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Where it links to (https) *</label>
          <input className={inputCls} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://wa.me/234... or https://..." />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Banner image *</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => pickImage(e.target.files?.[0] || null)}
            className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-black hover:file:bg-gray-200 cursor-pointer"
          />
          <p className="text-[10px] text-gray-400">
            Shown at a wide 16:5 shape (1200×375). Your image is centre-cropped and shrunk automatically. Keep key text in the middle.
          </p>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview" className="w-full aspect-[16/5] object-cover rounded-xl border mt-2" />
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Where to show it</label>
          <select className={`${inputCls} bg-white`} value={placement} onChange={(e) => setPlacement(e.target.value as PromoPlacement)}>
            {(Object.keys(PLACEMENT_LABEL) as PromoPlacement[]).map((k) => (
              <option key={k} value={k}>
                {PLACEMENT_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Starts</label>
            <input type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Ends (optional)</label>
            <input type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Active (uncheck to save it paused)
        </label>

        <p className="text-[10px] text-gray-400">
          The payer confirmation screen is what payers see after they submit. Banners never appear on the payment form,
          and links whose creator opted out don&apos;t show them. If several banners are live for the same place, they
          rotate randomly.
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {message && <p className="text-xs text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save banner'}
        </button>
      </form>

      {/* Existing */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Your banners</h3>
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-xs text-gray-400">
            No banners yet. Add your first one.
          </div>
        ) : (
          items.map((p) => {
            const st = state(p)
            const ctr = p.views > 0 ? ((p.clicks / p.views) * 100).toFixed(1) : '0.0'
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicUrl(p.image_path)} alt={p.title} className="w-full sm:w-56 aspect-[16/5] object-cover rounded-xl border shrink-0" loading="lazy" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{p.title}</p>
                    <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${st.cls}`}>{st.text}</span>
                  </div>
                  <a href={p.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all block">
                    {p.link_url}
                  </a>
                  <p className="text-[11px] text-gray-500">
                    {PLACEMENT_LABEL[p.placement]} · {new Date(p.starts_at).toLocaleDateString()}
                    {p.ends_at ? ` to ${new Date(p.ends_at).toLocaleDateString()}` : ' onwards'}
                  </p>
                  <p className="text-xs">
                    <span className="font-semibold">{p.views}</span> views · <span className="font-semibold">{p.clicks}</span> clicks ·{' '}
                    {ctr}% click rate
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={busy === p.id}
                      onClick={() => toggle(p)}
                      className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      {p.is_active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      disabled={busy === p.id}
                      onClick={() => remove(p)}
                      className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
