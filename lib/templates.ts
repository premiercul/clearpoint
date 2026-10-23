// lib/templates.ts
import { newFieldId } from '@/lib/fields'
import type { FormField, PricingMode, Template } from '@/lib/types'

const receipt = (): FormField => ({
  id: newFieldId(),
  label: 'Upload Payment Receipt Screenshot',
  type: 'image',
  required: true,
})

export interface TemplateCopy {
  pageTitle: string
  titleLabel: string
  titleHint: string
  descHint: string
  builderTitle: string
  priceHeading: string
  listTitle: string
  listBlurb: string
  newButton: string
  emptyTitle: string
  emptyBody: string
  emptyButton: string
  unitSingular: string
  unitPlural: string
  viewButton: string
  searchHint: string
  // payer page
  infoHeading: string
  submitButton: string
  successTitle: string
  successBody: string
}

export interface TemplateDef {
  copy: TemplateCopy
  label: string
  blurb: string
  pricingMode: PricingMode
  titleHint: string
  descriptionHint: string
  defaultFields: () => FormField[]
}

export const TEMPLATES: Record<Template, TemplateDef> = {
  academic: {
    copy: {
      pageTitle: 'New collection link',
      titleLabel: 'Collection title *',
      titleHint: 'e.g., GST 111 Manual / Departmental Dues',
      descHint: 'e.g., Pay before Friday, then upload your receipt.',
      builderTitle: 'What should students fill in?',
      priceHeading: '2. Amount to pay',
      listTitle: 'Your collections',
      listBlurb: 'Manage your links and see who has paid.',
      newButton: '+ New collection link',
      emptyTitle: 'No collections yet',
      emptyBody: 'Create a link for manuals, dues or clearance and collect names and receipts without handling any money.',
      emptyButton: 'Create first link',
      unitSingular: 'payment',
      unitPlural: 'payments',
      viewButton: 'View payments',
      searchHint: 'Search name or matric number...',
      infoHeading: 'Your details',
      submitButton: 'Submit Payment Proof',
      successTitle: 'Payment proof submitted!',
      successBody: 'Your details have been logged. Your rep can now verify your payment.',
    },
    label: 'Class rep / Lecturer',
    blurb: 'One fixed amount: manuals, dues, clearance.',
    pricingMode: 'fixed',
    titleHint: 'e.g., GST 111 Manual / Departmental Dues',
    descriptionHint: 'e.g., Pay before Friday, then upload your receipt.',
    defaultFields: () => [
      { id: newFieldId(), label: 'Matric Number / ID', type: 'text', required: true },
      { id: newFieldId(), label: 'Full Name', type: 'text', required: true },
      { id: newFieldId(), label: 'Department / Class', type: 'text', required: true },
      receipt(),
    ],
  },
  delivery: {
    copy: {
      pageTitle: 'New delivery run',
      titleLabel: 'Run title *',
      titleHint: 'e.g., Campus Runs · 12pm to 4pm',
      descHint: 'e.g., On-campus delivery only: departments, faculties and lecture halls.',
      builderTitle: 'What should customers fill in?',
      priceHeading: '2. Your delivery fee',
      listTitle: 'Your delivery runs',
      listBlurb: 'Open a run, share the link, then work through the orders.',
      newButton: '+ New delivery run',
      emptyTitle: 'No delivery runs yet',
      emptyBody: 'Create a run, share the link, and get orders with drop-off points, item costs and receipts in one place.',
      emptyButton: 'Create first run',
      unitSingular: 'order',
      unitPlural: 'orders',
      viewButton: 'View orders',
      searchHint: 'Search name, phone or drop-off point...',
      infoHeading: 'Your delivery details',
      submitButton: 'Submit Order',
      successTitle: 'Order sent!',
      successBody: 'Your runner has your order and will bring it to your drop-off point once your payment is confirmed.',
    },
    label: 'Delivery runner (on campus)',
    blurb: 'Your fixed fee + what the payer wants bought. Drops to departments and lecture halls.',
    pricingMode: 'delivery',
    titleHint: 'e.g., Campus Runs · 12pm to 4pm',
    descriptionHint: 'e.g., On-campus delivery only: departments, faculties and lecture halls.',
    defaultFields: () => [
      { id: newFieldId(), label: 'Full Name', type: 'text', required: true },
      { id: newFieldId(), label: 'Phone Number', type: 'tel', required: true },
      {
        id: newFieldId(),
        label: 'Drop-off point (department / lecture hall)',
        type: 'select',
        required: true,
        options: [],
      },
      { id: newFieldId(), label: 'Exact spot (e.g. LT2, Room 12, back row)', type: 'text', required: true },
      { id: newFieldId(), label: 'What should we buy or deliver?', type: 'textarea', required: true },
      receipt(),
    ],
  },
  vendor_social: {
    copy: {
      pageTitle: 'New order link',
      titleLabel: 'What are you selling? *',
      titleHint: 'e.g., Thrift Drop / Saturday Food Pre-order',
      descHint: 'e.g., Choose your items, pay, and upload your receipt. Pickup on campus.',
      builderTitle: 'What should customers fill in?',
      priceHeading: '2. Your product',
      listTitle: 'Your order links',
      listBlurb: 'One link per product. Share it, collect orders, and see who wants how many.',
      newButton: '+ New order link',
      emptyTitle: 'No order links yet',
      emptyBody: 'Create a link for your product and get orders with receipts, plus a clean list of who wants how many.',
      emptyButton: 'Create first link',
      unitSingular: 'order',
      unitPlural: 'orders',
      viewButton: 'View orders',
      searchHint: 'Search name, phone or pickup point...',
      infoHeading: 'Your details',
      submitButton: 'Submit Order',
      successTitle: 'Order sent!',
      successBody: 'The vendor will confirm your payment and prepare your items.',
    },
    label: 'Business / Vendor',
    blurb: 'One product per link: name, price and description. Customers choose how many.',
    pricingMode: 'items',
    titleHint: 'e.g., Thrift Drop / Saturday Food Pre-order',
    descriptionHint: 'e.g., Choose your items, pay, and upload your receipt. Pickup on campus.',
    defaultFields: () => [
      { id: newFieldId(), label: 'Full Name', type: 'text', required: true },
      { id: newFieldId(), label: 'Phone Number', type: 'tel', required: true },
      { id: newFieldId(), label: 'Pickup point on campus', type: 'select', required: true, options: [] },
      receipt(),
    ],
  },
}
