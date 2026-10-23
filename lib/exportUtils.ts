// lib/exportUtils.ts
import { fieldValue, type Collection, type Submission } from '@/lib/types'
import { amountOf, orderSummary, resolvePricing } from '@/lib/pricing'

// Looks like a plain number/phone (e.g. +234 801 234 5678): can't be a formula, leave as is.
const NUMERIC_LIKE = /^[+-]?\d[\d\s().-]*$/

function cell(value: unknown): string {
  let s = String(value ?? '')
  // CSV/formula injection guard: submitters are anonymous, so never let a cell start a formula.
  if (/^[=+\-@\t\r]/.test(s) && !NUMERIC_LIKE.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

type ExportCollection = Pick<Collection, 'title' | 'custom_fields' | 'pricing' | 'bank_details'>

/** Returns false when there is nothing to export. */
export function exportToCSV(submissions: Submission[], collection: ExportCollection, suffix = 'submissions'): boolean {
  if (!submissions || submissions.length === 0) return false

  const fields = collection.custom_fields || []
  const pricing = resolvePricing(collection)
  const hasItems = pricing?.mode === 'items'
  const hasItemCost = pricing?.mode === 'delivery'

  const headers = [
    'Submitted At',
    ...fields.map((f) => f.label),
    ...(hasItems ? ['Order'] : []),
    ...(hasItemCost ? ['Item cost (NGN)'] : []),
    'Total expected (NGN)',
    'Status',
    'Fulfilled',
  ]

  const rows = submissions.map((sub) =>
    [
      new Date(sub.submitted_at).toLocaleString(),
      ...fields.map((f) => (f.type === 'image' ? (fieldValue(sub, f) ? 'Uploaded' : '') : fieldValue(sub, f))),
      ...(hasItems ? [orderSummary(sub, pricing)] : []),
      ...(hasItemCost ? [sub.item_cost ?? ''] : []),
      amountOf(sub, collection),
      sub.status,
      sub.fulfilled ? 'Yes' : 'No',
    ]
      .map(cell)
      .join(',')
  )

  // BOM so Excel reads UTF-8 names correctly
  const csv = '\uFEFF' + [headers.map(cell).join(','), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${(collection.title || 'collection').replace(/[^\w-]+/g, '_')}_${suffix}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
