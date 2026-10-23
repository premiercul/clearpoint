// lib/types.ts
export type FieldType = 'text' | 'number' | 'tel' | 'image' | 'textarea' | 'select'

export interface FormField {
  id: string | number // older collections used numeric ids
  label: string
  type: FieldType
  required: boolean
  options?: string[] // for 'select' fields
}

export type Template = 'academic' | 'delivery' | 'vendor_social'
export type PricingMode = 'fixed' | 'delivery' | 'items'

export interface PriceItem {
  id: string
  name: string
  price: number
  description?: string
}

export type Pricing =
  | { mode: 'fixed'; amount: number }
  | { mode: 'delivery'; fee: number } // payer adds the cost of what they want bought
  | { mode: 'items'; items: PriceItem[]; fee?: number }

export interface BankDetails {
  bankName: string
  accountNumber: string
  accountName: string
  amount?: number // legacy links kept their fixed amount here
}

export interface Collection {
  id: string
  creator_id?: string
  title: string
  description: string | null
  template?: Template
  bank_details: BankDetails
  pricing: Pricing | null
  custom_fields: FormField[]
  is_active: boolean
  closes_at: string | null
  admin_disabled?: boolean // taken down by ClearPoint
  admin_note?: string | null
  show_sponsored?: boolean // creator opt-out for the payer confirmation-screen banner
  created_at: string
  submissions?: { count: number }[]
}

export type SubmissionStatus = 'pending' | 'verified' | 'flagged'

export interface Submission {
  id: string
  collection_id: string
  form_data: Record<string, string>
  receipt_url: string | null
  receipt_path: string | null
  total_amount: number | null
  order_items: Record<string, number> | null
  item_cost: number | null
  fulfilled: boolean
  status: SubmissionStatus
  submitted_at: string
}

/** Submissions are keyed by field id; older rows were keyed by label, so fall back to that. */
export function fieldValue(sub: Pick<Submission, 'form_data'>, f: FormField): string {
  const data = sub.form_data || {}
  return data[String(f.id)] ?? data[f.label] ?? ''
}
