// app/dashboard/create/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'
import DynamicFieldBuilder from '@/components/DynamicFieldBuilder'
import PricingEditor, { type PriceItemDraft } from '@/components/PricingEditor'
import { newFieldId } from '@/lib/fields'
import { TEMPLATES } from '@/lib/templates'
import type { FormField, PriceItem, Pricing, PricingMode, Template } from '@/lib/types'

const inputCls = 'w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-black'

export default function CreateCollectionPage() {
  // The account type chosen at sign-up decides the whole form (wording, price setup, starting fields).
  const [template, setTemplate] = useState<Template | null>(null)
  // Reps normally collect one fixed amount; they can switch to a price list for several items.
  const [repUsesList, setRepUsesList] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [showSponsored, setShowSponsored] = useState(true)

  const [fixedAmount, setFixedAmount] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('')
  const [items, setItems] = useState<PriceItemDraft[]>(() => [{ id: newFieldId(), name: '', price: '', description: '' }])
  const [extraFee, setExtraFee] = useState('')

  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')

  const [fields, setFields] = useState<FormField[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/')
        return
      }
      const { data } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle()
      const t = data?.account_type as Template | undefined
      if (!t || !TEMPLATES[t]) {
        router.replace('/onboarding')
        return
      }
      setTemplate(t)
      setFields(TEMPLATES[t].defaultFields())
    }
    loadProfile()
  }, [router, supabase])

  if (!template) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">Loading...</div>
    )
  }

  const def = TEMPLATES[template]
  const pricingMode: PricingMode =
    template === 'delivery' ? 'delivery' : template === 'vendor_social' ? 'items' : repUsesList ? 'items' : 'fixed'
  const priceHeading = template === 'academic' && pricingMode === 'items' ? '2. Your price list' : def.copy.priceHeading

  const buildPricing = (): Pricing | string => {
    if (pricingMode === 'fixed') {
      const amount = Number(fixedAmount)
      if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount greater than zero.'
      return { mode: 'fixed', amount }
    }
    if (pricingMode === 'delivery') {
      const fee = Number(deliveryFee)
      if (!Number.isFinite(fee) || fee <= 0) return 'Enter your delivery fee (greater than zero).'
      return { mode: 'delivery', fee }
    }
    // ignore rows the creator never touched
    const rows = items.filter((it) => it.name.trim() || it.price.trim() || it.description.trim())
    const list: PriceItem[] = rows.map((it) => {
      const item: PriceItem = { id: it.id, name: it.name.trim(), price: Number(it.price) }
      if (it.description.trim()) item.description = it.description.trim()
      return item
    })
    if (list.length === 0 || list.some((it) => !it.name || !Number.isFinite(it.price) || it.price <= 0)) {
      return template === 'vendor_social'
        ? 'Add your product name and a price above zero.'
        : 'Give every item a name and a price above zero.'
    }
    if (template === 'vendor_social' && list.length > 1) return 'Each link sells one product. Create another link for the next one.'
    const fee = extraFee.trim() === '' ? undefined : Number(extraFee)
    if (fee !== undefined && (!Number.isFinite(fee) || fee < 0)) return 'The delivery / handling fee must be zero or more.'
    return fee ? { mode: 'items', items: list, fee } : { mode: 'items', items: list }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanAccount = accountNumber.replace(/\s/g, '')

    if (!title.trim() || !bankName.trim() || !accountName.trim()) {
      setError('Please fill in the title, bank name and account name.')
      return
    }
    if (!/^\d{10}$/.test(cleanAccount)) {
      setError('Account number must be exactly 10 digits.')
      return
    }
    const pricing = buildPricing()
    if (typeof pricing === 'string') {
      setError(pricing)
      return
    }
    if (fields.length === 0) {
      setError('Add at least one field for payers to fill in.')
      return
    }
    const emptyDropdown = fields.find((f) => f.type === 'select' && (!f.options || f.options.length === 0))
    if (emptyDropdown) {
      setError(`Add at least one choice to "${emptyDropdown.label}".`)
      return
    }
    let closes: string | null = null
    if (closesAt) {
      const d = new Date(closesAt)
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        setError('The closing time must be in the future.')
        return
      }
      closes = d.toISOString()
    }

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/')
      return
    }

    const { error: insertError } = await supabase.from('collections').insert({
      creator_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      template,
      bank_details: {
        bankName: bankName.trim(),
        accountNumber: cleanAccount,
        accountName: accountName.trim(),
      },
      pricing,
      custom_fields: fields,
      closes_at: closes,
      show_sponsored: showSponsored,
      is_active: true,
    })

    if (insertError) {
      setLoading(false)
      // 42501 = blocked by row-level security (a suspended account can't create links)
      setError(
        insertError.code === '42501'
          ? 'Your account can’t create links right now. Please contact ClearPoint support.'
          : 'Error creating collection. Please try again.'
      )
      return
    }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gray-50 text-black py-8 px-4 sm:px-8">
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/dashboard" className="text-xs text-gray-500 hover:underline">
            ← Back to Dashboard
          </Link>
          <div className="text-right">
            <h1 className="font-bold text-lg">{def.copy.pageTitle}</h1>
            <p className="text-[11px] text-gray-400">
              {def.label} account ·{' '}
              <Link href="/onboarding" className="underline hover:text-gray-600">
                change
              </Link>
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
              <h2 className="font-semibold text-sm text-gray-900">1. Basic Information</h2>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">{def.copy.titleLabel}</label>
                <input
                  type="text"
                  placeholder={def.copy.titleHint}
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Description / Instructions (Optional)</label>
                <textarea
                  placeholder={def.copy.descHint}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Close automatically at (Optional)</label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className={inputCls}
                />
                <p className="text-[10px] text-gray-400">After this time the link stops accepting submissions.</p>
              </div>

              <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={showSponsored}
                  onChange={(e) => setShowSponsored(e.target.checked)}
                />
                <span>
                  Allow a small sponsored banner on the confirmation screen payers see after they submit.
                  <span className="block text-[10px] text-gray-400">
                    Payers never see ads on the payment form itself. You can change this later from your dashboard.
                  </span>
                </span>
              </label>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
              <h2 className="font-semibold text-sm text-gray-900">{priceHeading}</h2>
              <PricingEditor
                mode={pricingMode}
                single={template === 'vendor_social'}
                fixedAmount={fixedAmount}
                setFixedAmount={setFixedAmount}
                deliveryFee={deliveryFee}
                setDeliveryFee={setDeliveryFee}
                items={items}
                setItems={setItems}
                extraFee={extraFee}
                setExtraFee={setExtraFee}
              />
              {template === 'academic' && (
                <button
                  type="button"
                  onClick={() => setRepUsesList((v) => !v)}
                  className="text-xs text-gray-500 underline hover:text-gray-700"
                >
                  {repUsesList ? 'Back to one fixed amount' : 'Collecting for more than one item? Use a price list'}
                </button>
              )}
              <p className="text-[10px] text-gray-400">
                Payers see their total, and you see the amount to expect next to each receipt. We never touch your money.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
              <h2 className="font-semibold text-sm text-gray-900">3. Destination Bank Details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Bank Name *</label>
                  <input
                    type="text"
                    placeholder="e.g., OPay, Kuda, GTBank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Account Number (10 digits) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="\d{10}"
                    placeholder="e.g., 0123456789"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Account Name *</label>
                <input
                  type="text"
                  placeholder="e.g., John Doe"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4 shadow-sm">
            <h2 className="font-semibold text-sm text-gray-900">4. Form Fields Builder</h2>
            <DynamicFieldBuilder fields={fields} setFields={setFields} heading={def.copy.builderTitle} template={template} />
          </div>

          {error && (
            <div className="lg:col-span-2 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl px-4 py-3">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="lg:col-span-2 w-full py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-60"
          >
            {loading ? 'Publishing Link...' : 'Publish & Generate Link'}
          </button>
        </form>
      </div>
    </main>
  )
}
