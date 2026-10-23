// app/pay/[id]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { compressImage } from '@/lib/image'
import { uuid } from '@/lib/fields'
import { uploadImage } from '@/lib/storage'
import { computeTotal, naira, resolvePricing } from '@/lib/pricing'
import { TEMPLATES } from '@/lib/templates'
import type { Collection } from '@/lib/types'
import { REASON_LABEL, type ReportReason } from '@/lib/adminTypes'
import PromoBanner from '@/components/PromoBanner'
import Link from 'next/link'

type PublicCollection = Pick<
  Collection,
  'id' | 'title' | 'description' | 'template' | 'bank_details' | 'custom_fields' | 'pricing' | 'closes_at'
>

const MAX_RAW_MB = 15
const inputCls = 'w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-black'
const fileCls =
  'w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-black hover:file:bg-gray-200 cursor-pointer'

function friendlyError(message: string): string {
  if (message.includes('rate_limited')) return 'Too many submissions from your network. Please wait a few minutes and try again.'
  if (message.includes('collection_unavailable')) return 'This link is no longer accepting submissions.'
  if (message.includes('missing_field')) return 'Please fill in every required field.'
  if (message.includes('invalid_form')) return 'Something in the form was not accepted. Please check your entries and try again.'
  if (message.includes('invalid_amount')) return 'Please check the item cost you entered.'
  if (message.includes('invalid_order')) return 'Please choose at least one item.'
  if (message === 'unsupported_image') return 'Could not read that image. Please upload a JPG or PNG screenshot.'
  return 'Error submitting payment proof. Please check your network and try again.'
}

export default function StudentPaymentPage() {
  const params = useParams()
  const collectionId = params.id as string
  const supabase = createClientComponentClient()

  const [collection, setCollection] = useState<PublicCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Dynamic form state, keyed by field id
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [imageFiles, setImageFiles] = useState<Record<string, File | null>>({})
  const [itemCost, setItemCost] = useState('') // delivery: cost of what they want bought
  const [qty, setQty] = useState<Record<string, number>>({}) // price list: item id -> quantity
  const [honeypot, setHoneypot] = useState('') // bots fill this, people never see it
  const [copied, setCopied] = useState(false)

  // reporting a link
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason>('scam')
  const [reportDetails, setReportDetails] = useState('')
  const [reportBusy, setReportBusy] = useState(false)
  const [reportMsg, setReportMsg] = useState('')

  useEffect(() => {
    async function fetchCollection() {
      if (!collectionId) return
      const { data, error } = await supabase.rpc('get_public_collection', { p_id: collectionId })

      if (!error && data) {
        const col = data as PublicCollection
        setCollection(col)
        const initial: Record<string, string> = {}
        col.custom_fields?.forEach((field) => {
          initial[String(field.id)] = ''
        })
        setFormData(initial)
      }
      setLoading(false)
    }

    fetchCollection()
  }, [collectionId, supabase])

  const handleInputChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const copyAccountNumber = async (accountNumber: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy the account number:', accountNumber)
    }
  }

  const pricing = collection ? resolvePricing(collection) : null
  const itemCostNum = itemCost.trim() === '' ? NaN : Number(itemCost)
  const total = computeTotal(pricing, Number.isFinite(itemCostNum) ? itemCostNum : 0, qty)

  const sendReport = async () => {
    setReportBusy(true)
    setReportMsg('')
    const { error } = await supabase.rpc('report_link', {
      p_collection_id: collectionId,
      p_reason: reportReason,
      p_details: reportDetails.trim() || null,
    })
    setReportBusy(false)
    if (error) {
      setReportMsg(
        error.message.includes('rate_limited')
          ? 'Too many reports from your network. Please try again later.'
          : 'Could not send your report. Please try again.'
      )
      return
    }
    setReportMsg('Thank you. We will review this link.')
    setReportOpen(false)
    setReportDetails('')
  }

  const setQuantity = (id: string, next: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, Math.min(99, next)) }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (honeypot) {
      setSubmitted(true) // pretend success, store nothing
      return
    }
    if (!pricing) {
      setError('This link is not set up correctly. Please contact the person who shared it.')
      return
    }

    // price checks
    let orderPayload: Record<string, number> | null = null
    let itemCostPayload: number | null = null
    if (pricing.mode === 'delivery') {
      if (!Number.isFinite(itemCostNum) || itemCostNum < 0 || itemCostNum > 1000000) {
        setError('Enter the cost of what you want bought (enter 0 if there is nothing to buy).')
        return
      }
      itemCostPayload = itemCostNum
    }
    if (pricing.mode === 'items') {
      const order: Record<string, number> = {}
      for (const [itemId, q] of Object.entries(qty) as [string, number][]) {
        if (q > 0) order[itemId] = q
      }
      orderPayload = order
      if (Object.keys(order).length === 0) {
        setError('Choose at least one item.')
        return
      }
    }

    const imageFields = (collection?.custom_fields || []).filter((f) => f.type === 'image')
    const toUpload: { id: string; file: File }[] = []
    for (const f of imageFields) {
      const id = String(f.id)
      const file = imageFiles[id]
      if (!file) {
        if (f.required !== false) {
          setError(`Please upload: ${f.label}`)
          return
        }
        continue
      }
      toUpload.push({ id, file })
    }
    for (const file of toUpload.map((t) => t.file)) {
      if (file.size > MAX_RAW_MB * 1024 * 1024) {
        setError(`"${file.name}" is too large. Please choose an image under ${MAX_RAW_MB}MB.`)
        return
      }
    }

    setSubmitting(true)

    try {
      // Shrink each image, then upload to the private bucket as <collection-id>/<random-uuid>.jpg
      const uploadOne = async (file: File): Promise<string> => {
        const blob = await compressImage(file)
        const filePath = `${collectionId}/${uuid()}.jpg`
        await uploadImage(supabase, filePath, blob)
        return filePath
      }

      const uploadedPaths = await Promise.all(toUpload.map((t) => uploadOne(t.file)))

      const data: Record<string, string> = { ...formData }
      toUpload.forEach((t, i) => {
        data[t.id] = uploadedPaths[i]
      })

      // The database works out the real total itself; we only send what the payer chose.
      const { error: rpcError } = await supabase.rpc('submit_proof', {
        p_collection_id: collectionId,
        p_form_data: data,
        p_order: orderPayload,
        p_item_cost: itemCostPayload,
      })
      if (rpcError) throw rpcError

      setSubmitted(true)
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message || ''
      setError(friendlyError(message))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-gray-400">
        Loading collection...
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-red-500 px-4 text-center">
        Collection link not found or no longer active.
      </div>
    )
  }

  const { bank_details: bank } = collection
  const copy = TEMPLATES[collection.template ?? 'academic'].copy
  const hasImageField = collection.custom_fields?.some((f) => f.type === 'image')

  // What the black card shows as the amount
  const cardAmount =
    pricing?.mode === 'fixed'
      ? naira(pricing.amount)
      : pricing?.mode === 'delivery'
      ? Number.isFinite(itemCostNum)
        ? naira(total)
        : `${naira(pricing.fee)} + item cost`
      : pricing?.mode === 'items'
      ? total > 0
        ? naira(total)
        : 'Choose your items below'
      : ''

  return (
    <main className="min-h-screen bg-gray-50 text-black py-8 px-4 flex flex-col justify-center items-center">
      <div className="max-w-md w-full space-y-6">
        {submitted ? (
          <>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mx-auto text-lg font-bold">
              ✓
            </div>
            <h2 className="font-bold text-lg">{copy.successTitle}</h2>
            <p className="text-xs text-gray-500">
              {copy.successBody}
            </p>
          </div>
          {/* Sponsored banner: only here, after the payment is done, never on the form */}
          <PromoBanner placement="payer_success" collectionId={collectionId} />
          </>
        ) : (
          <>
            {/* Header info */}
            <div className="space-y-1 text-center">
              <h1 className="text-xl font-bold tracking-tight">{collection.title}</h1>
              <p className="text-xs text-gray-500">
                {collection.description ||
                  'Make your transfer to the account below, then fill out your details and upload your receipt.'}
              </p>
              {collection.closes_at && (
                <p className="text-[11px] text-gray-400">Closes {new Date(collection.closes_at).toLocaleString()}</p>
              )}
            </div>

            {/* Bank Card Widget */}
            <div className="bg-black text-white p-5 rounded-2xl space-y-3 shadow-md">
              <div className="flex justify-between items-center text-xs text-gray-400 uppercase tracking-wider font-medium">
                <span>Transfer To</span>
                <span>{bank.bankName}</span>
              </div>
              {cardAmount && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Amount to transfer</p>
                  <p className="text-xl font-bold">{cardAmount}</p>
                </div>
              )}
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-mono font-bold tracking-tight">{bank.accountNumber}</p>
                  <p className="text-xs text-gray-300 mt-0.5">{bank.accountName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyAccountNumber(bank.accountNumber)}
                  className="px-3 py-1.5 bg-white text-black rounded-xl text-xs font-semibold hover:bg-gray-100 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy Account'}
                </button>
              </div>
            </div>

            {/* Submission Form */}
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
              {/* Delivery: fee + item cost */}
              {pricing?.mode === 'delivery' && (
                <div className="space-y-2 pb-4 border-b border-gray-100">
                  <label htmlFor="item-cost" className="text-xs font-medium text-gray-700">
                    Cost of what you want bought (₦) *
                  </label>
                  <input
                    id="item-cost"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    required
                    placeholder="e.g., 1500 (enter 0 if nothing to buy)"
                    value={itemCost}
                    onChange={(e) => setItemCost(e.target.value)}
                    className={inputCls}
                  />
                  <div className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Delivery fee</span>
                      <span>{naira(pricing.fee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Items</span>
                      <span>{naira(Number.isFinite(itemCostNum) ? itemCostNum : 0)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-black pt-1 border-t border-gray-200">
                      <span>Total to transfer</span>
                      <span>{naira(total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Price list */}
              {pricing?.mode === 'items' && (
                <div className="space-y-2 pb-4 border-b border-gray-100">
                  <h2 className="font-semibold text-sm text-gray-900">
                    {pricing.items.length === 1 ? 'How many do you want?' : 'Choose your items'}
                  </h2>
                  <div className="space-y-2">
                    {pricing.items.map((it) => {
                      const q = qty[it.id] || 0
                      return (
                        <div key={it.id} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{it.name}</p>
                            <p className="text-xs text-gray-500">{naira(it.price)}</p>
                            {it.description && <p className="text-[11px] text-gray-500 mt-0.5">{it.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setQuantity(it.id, q - 1)}
                              disabled={q === 0}
                              aria-label={`Remove one ${it.name}`}
                              className="w-8 h-8 rounded-full border text-base leading-none disabled:opacity-30"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{q}</span>
                            <button
                              type="button"
                              onClick={() => setQuantity(it.id, q + 1)}
                              aria-label={`Add one ${it.name}`}
                              className="w-8 h-8 rounded-full bg-black text-white text-base leading-none"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 space-y-0.5">
                    {pricing.fee ? (
                      <div className="flex justify-between">
                        <span>Delivery / handling fee</span>
                        <span>{naira(pricing.fee)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-semibold text-black">
                      <span>Total to transfer</span>
                      <span>{naira(total)}</span>
                    </div>
                  </div>
                </div>
              )}

              <h2 className="font-semibold text-sm text-gray-900">{copy.infoHeading}</h2>

              {collection.custom_fields?.map((field) => {
                const id = String(field.id)
                const required = field.required !== false
                const label = (
                  <label htmlFor={`f-${id}`} className="text-xs font-medium text-gray-700">
                    {field.label} {required && '*'}
                  </label>
                )

                if (field.type === 'image') {
                  return (
                    <div key={id} className="space-y-1">
                      {label}
                      <input
                        id={`f-${id}`}
                        type="file"
                        accept="image/*"
                        required={required}
                        onChange={(e) => setImageFiles((prev) => ({ ...prev, [id]: e.target.files?.[0] || null }))}
                        className={fileCls}
                      />
                    </div>
                  )
                }

                if (field.type === 'select') {
                  return (
                    <div key={id} className="space-y-1">
                      {label}
                      <select
                        id={`f-${id}`}
                        required={required}
                        value={formData[id] || ''}
                        onChange={(e) => handleInputChange(id, e.target.value)}
                        className={`${inputCls} bg-white`}
                      >
                        <option value="">Select...</option>
                        {(field.options || []).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                }

                if (field.type === 'textarea') {
                  return (
                    <div key={id} className="space-y-1">
                      {label}
                      <textarea
                        id={`f-${id}`}
                        required={required}
                        rows={3}
                        maxLength={500}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        value={formData[id] || ''}
                        onChange={(e) => handleInputChange(id, e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  )
                }

                return (
                  <div key={id} className="space-y-1">
                    {label}
                    <input
                      id={`f-${id}`}
                      type={field.type === 'number' ? 'number' : field.type === 'tel' ? 'tel' : 'text'}
                      inputMode={field.type === 'number' ? 'numeric' : field.type === 'tel' ? 'tel' : undefined}
                      required={required}
                      maxLength={200}
                      placeholder={`Enter your ${field.label.toLowerCase()}`}
                      value={formData[id] || ''}
                      onChange={(e) => handleInputChange(id, e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )
              })}

              {/* Honeypot (hidden from people) */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </label>
              </div>

              {hasImageField && (
                <p className="text-[10px] text-gray-400">Your images are shrunk automatically to save data.</p>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-60"
              >
                {submitting ? 'Sending...' : copy.submitButton}
              </button>
            </form>
          </>
        )}

        {/* Report + privacy */}
        <div className="text-center space-y-2 pt-2">
          {reportMsg && <p className="text-xs text-green-700">{reportMsg}</p>}
          {!reportOpen ? (
            <p className="text-[11px] text-gray-400">
              <button type="button" onClick={() => setReportOpen(true)} className="underline hover:text-gray-600">
                Report this link
              </button>{' '}
              ·{' '}
              <Link href="/privacy" className="underline hover:text-gray-600">
                Privacy
              </Link>
            </p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-left space-y-3 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-900">Report this link</h3>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ReportReason)}
                aria-label="Reason"
                className={`${inputCls} bg-white`}
              >
                {(Object.keys(REASON_LABEL) as ReportReason[]).map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABEL[r]}
                  </option>
                ))}
              </select>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Tell us what happened (optional)"
                className={inputCls}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reportBusy}
                  onClick={sendReport}
                  className="px-4 py-2 bg-black text-white text-xs font-medium rounded-xl disabled:opacity-60"
                >
                  {reportBusy ? 'Sending...' : 'Send report'}
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="px-4 py-2 border text-xs font-medium rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
