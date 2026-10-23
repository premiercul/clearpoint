// lib/pricing.ts
import type { Collection, FormField, Pricing, Submission } from '@/lib/types'

export const naira = (n: number) => `₦${Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`

/** Older links stored their fixed amount in bank_details.amount. */
export function resolvePricing(col: Pick<Collection, 'pricing' | 'bank_details'>): Pricing | null {
  if (col.pricing) return col.pricing
  const a = Number(col.bank_details?.amount)
  return Number.isFinite(a) && a > 0 ? { mode: 'fixed', amount: a } : null
}

/** Live total shown to the payer. The database recomputes it on submit; this is only for display. */
export function computeTotal(p: Pricing | null, itemCost: number, order: Record<string, number>): number {
  if (!p) return 0
  if (p.mode === 'fixed') return p.amount
  if (p.mode === 'delivery') return p.fee + Math.max(0, itemCost || 0)
  const sum = p.items.reduce((acc, it) => acc + it.price * (order[it.id] || 0), 0)
  return sum + (p.fee || 0)
}

/** What a submission should have paid (server-computed; falls back to the legacy fixed amount). */
export function amountOf(sub: Pick<Submission, 'total_amount'>, col: Pick<Collection, 'pricing' | 'bank_details'>): number {
  if (sub.total_amount !== null && sub.total_amount !== undefined) return Number(sub.total_amount)
  const p = resolvePricing(col)
  return p && p.mode === 'fixed' ? p.amount : 0
}

export function orderSummary(sub: Pick<Submission, 'order_items'>, p: Pricing | null): string {
  if (!sub.order_items || !p || p.mode !== 'items') return ''
  return p.items
    .filter((it) => (sub.order_items?.[it.id] || 0) > 0)
    .map((it) => `${sub.order_items?.[it.id]}× ${it.name}`)
    .join(', ')
}

export function describePricing(p: Pricing | null): string {
  if (!p) return ''
  if (p.mode === 'fixed') return `${naira(p.amount)} each`
  if (p.mode === 'delivery') return `Delivery fee ${naira(p.fee)} + item cost`
  if (p.items.length === 1) return `${p.items[0].name} · ${naira(p.items[0].price)} each`
  return `Price list · ${p.items.length} items`
}

export function findField(fields: FormField[], re: RegExp): FormField | undefined {
  return fields.find((f) => f.type !== 'image' && re.test(f.label))
}
