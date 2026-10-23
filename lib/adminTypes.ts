// lib/adminTypes.ts
import type { BankDetails, Template } from '@/lib/types'

export interface AdminOverview {
  users: number
  new_creators_7d: number
  links: number
  active_links: number
  disabled_links: number
  links_by_template: Partial<Record<Template, number>>
  submissions: number
  submissions_7d: number
  verified_volume: number
  pending_volume: number
  open_reports: number
  payer_views_7d: number
  last_keepalive: string | null
  storage_bytes: number
  daily: { day: string; n: number }[]
}

export interface AdminLink {
  id: string
  title: string
  template: Template
  creator_id: string
  creator_email: string | null
  creator_name: string | null
  is_active: boolean
  admin_disabled: boolean
  admin_note: string | null
  closes_at: string | null
  created_at: string
  bank_details: BankDetails
  submissions: number
  open_reports: number
}

export interface AdminCreator {
  id: string
  email: string | null
  full_name: string | null
  account_type: Template | null
  is_admin: boolean
  suspended: boolean
  created_at: string
  links: number
  submissions: number
}

export type ReportReason = 'scam' | 'wrong_details' | 'inappropriate' | 'other'
export type ReportStatus = 'open' | 'resolved' | 'dismissed'

export const REASON_LABEL: Record<ReportReason, string> = {
  scam: 'Looks like a scam',
  wrong_details: 'Wrong account details',
  inappropriate: 'Inappropriate content',
  other: 'Something else',
}

export interface AdminReport {
  id: string
  reason: ReportReason
  details: string | null
  status: ReportStatus
  created_at: string
  link_id: string
  link_title: string
  link_disabled: boolean
  creator_email: string | null
  bank_details: BankDetails
  reports_on_link: number
  submissions: number
}

export type PromoPlacement = 'dashboard' | 'landing' | 'both' | 'payer_success' | 'everywhere'

export interface AdminPromotion {
  id: string
  title: string
  image_path: string
  link_url: string
  placement: PromoPlacement
  is_active: boolean
  starts_at: string
  ends_at: string | null
  views: number
  clicks: number
  created_at: string
}
