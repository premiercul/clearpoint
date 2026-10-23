// lib/money.ts
import { fieldValue, type Collection, type FormField, type Submission } from '@/lib/types'

export const formatNaira = (n: number) => `₦${Number(n).toLocaleString('en-NG')}`

/** "2,500" / "2500.50" -> number. Anything unreadable counts as 0. */
export function parseAmount(v: unknown): number {
  const n = Number(String(v ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

/** Creator's base amount (price or delivery fee) + every amount the payer typed in. */
export function totalFor(base: number, fields: FormField[], values: Record<string, string>): number {
  return fields
    .filter((f) => f.type === 'amount')
    .reduce((sum, f) => sum + parseAmount(values[String(f.id)]), Number(base) || 0)
}

export function submissionTotal(sub: Pick<Submission, 'form_data'>, collection: Pick<Collection, 'bank_details' | 'custom_fields'>): number {
  const values: Record<string, string> = {}
  for (const f of collection.custom_fields || []) values[String(f.id)] = fieldValue(sub, f)
  return totalFor(collection.bank_details?.amount, collection.custom_fields || [], values)
}
