// components/DynamicFieldBuilder.tsx
'use client'
import { useState } from 'react'
import { newFieldId } from '@/lib/fields'
import type { FieldType, FormField, Template } from '@/lib/types'

const MAX_IMAGE_FIELDS = 4

const QUICK_ADD: { label: string; text: string; type: FieldType; options?: string[]; for?: Template[] }[] = [
  { label: 'Matric Number / ID', text: '+ Matric Number', type: 'text', for: ['academic'] },
  { label: 'Full Name', text: '+ Full Name', type: 'text' },
  { label: 'Department / Class', text: '+ Department', type: 'text', for: ['academic'] },
  { label: 'Phone Number', text: '+ Phone Number', type: 'tel' },
  { label: 'Drop-off point (department / lecture hall)', text: '+ Drop-off Point', type: 'select', options: [], for: ['delivery'] },
  { label: 'Pickup point on campus', text: '+ Pickup Point', type: 'select', options: [], for: ['vendor_social'] },
  { label: 'Upload Payment Receipt Screenshot', text: '+ Payment Receipt', type: 'image' },
  { label: 'Photo of Item / ID', text: '+ Image Upload', type: 'image' },
]

const TYPE_LABEL: Record<FieldType, string> = {
  text: 'text',
  number: 'number',
  tel: 'phone',
  image: 'image upload',
  textarea: 'long text',
  select: 'dropdown',
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (o: string[]) => void }) {
  const [text, setText] = useState('')

  const add = () => {
    const parts = text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s.length <= 80)
    if (parts.length === 0) return
    const next = [...options]
    for (const p of parts) {
      if (!next.some((o) => o.toLowerCase() === p.toLowerCase())) next.push(p)
    }
    onChange(next.slice(0, 60))
    setText('')
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
      <p className="text-[11px] text-gray-500">
        Choices payers can pick from (add several at once with commas):
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <span key={o} className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-xs rounded-full pl-2.5 pr-1.5 py-1">
            {o}
            <button
              type="button"
              onClick={() => onChange(options.filter((x) => x !== o))}
              aria-label={`Remove ${o}`}
              className="text-gray-400 hover:text-red-600 text-sm leading-none"
            >
              ×
            </button>
          </span>
        ))}
        {options.length === 0 && <span className="text-[11px] text-amber-700">Add at least one choice.</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault() // don't submit the outer form
              add()
            }
          }}
          placeholder="e.g. Library, Faculty of Science, LT1"
          className="flex-1 px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button type="button" onClick={add} className="px-3 py-1.5 bg-black text-white text-xs rounded-lg hover:bg-gray-800">
          Add
        </button>
      </div>
    </div>
  )
}

export default function DynamicFieldBuilder({
  fields,
  setFields,
  heading = 'What should payers fill in?',
  template,
}: {
  fields: FormField[]
  setFields: (f: FormField[]) => void
  heading?: string
  template?: Template
}) {
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('text')
  const [error, setError] = useState('')

  const exists = (l: string) => fields.some((f) => f.label.trim().toLowerCase() === l.trim().toLowerCase())
  const imageCount = fields.filter((f) => f.type === 'image').length

  const addField = (l: string, type: FieldType, options?: string[]): boolean => {
    if (exists(l)) return false
    if (type === 'image' && imageCount >= MAX_IMAGE_FIELDS) {
      setError(`You can add up to ${MAX_IMAGE_FIELDS} image uploads in total.`)
      return false
    }
    setError('')
    const f: FormField = { id: newFieldId(), label: l.trim(), type, required: true }
    if (type === 'select') f.options = options ?? []
    setFields([...fields, f])
    return true
  }

  // NOTE: this is a <div>, not a <form>, because the builder sits inside the page's own <form>
  // (nested forms are invalid HTML and break hydration).
  const addCustomField = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    if (trimmed.length > 80) {
      setError('Keep field names under 80 characters.')
      return
    }
    if (exists(trimmed)) {
      setError('You already have a field with that name.')
      return
    }
    if (addField(trimmed, fieldType)) setLabel('')
  }

  const patch = (id: FormField['id'], p: Partial<FormField>) =>
    setFields(fields.map((f) => (f.id === id ? { ...f, ...p } : f)))

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <h3 className="font-semibold text-gray-800">{heading}</h3>
      <p className="text-[11px] text-gray-500">
        Add an image upload for the payment receipt so payers can prove they paid. Dropdowns let you control the answers
        (e.g. your campus drop-off points).
      </p>
      {fields.filter((f) => f.type === 'image').length === 0 && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          No image upload added: payers won&apos;t be asked for a payment receipt. Tap &quot;+ Payment Receipt&quot; to add one.
        </p>
      )}

      {/* Quick Click Suggestions */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 self-center">Quick Add:</span>
        {QUICK_ADD.filter((q) => !q.for || !template || q.for.includes(template)).map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={exists(q.label) || (q.type === 'image' && imageCount >= MAX_IMAGE_FIELDS)}
            onClick={() => addField(q.label, q.type, q.options)}
            className="px-3 py-1 bg-white border rounded-full text-xs hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {q.text}
          </button>
        ))}
      </div>

      {/* List of current fields */}
      <div className="space-y-2">
        {fields.map((f, index) => (
          <div key={f.id} className="bg-white p-3 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-700 min-w-0 truncate">
                {index + 1}. {f.label}{' '}
                <span className="text-[10px] text-gray-400 font-normal">({TYPE_LABEL[f.type] || f.type})</span>
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={f.required} onChange={() => patch(f.id, { required: !f.required })} />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => setFields(fields.filter((item) => item.id !== f.id))}
                  className="text-red-500 text-xs hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
            {f.type === 'select' && (
              <OptionsEditor options={f.options || []} onChange={(options) => patch(f.id, { options })} />
            )}
          </div>
        ))}
        {fields.length === 0 && <p className="text-xs text-gray-400">Add at least one field.</p>}
      </div>

      {/* Add Custom Field */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
        <input
          type="text"
          placeholder="Add custom field (e.g. T-Shirt Size)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault() // don't submit the outer form
              addCustomField()
            }
          }}
          className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
        />
        <select
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value as FieldType)}
          className="px-3 py-2 text-sm border rounded-lg bg-white"
          aria-label="Field type"
        >
          <option value="text">Text</option>
          <option value="textarea">Long text</option>
          <option value="number">Number</option>
          <option value="tel">Phone</option>
          <option value="select">Dropdown</option>
          <option value="image">Image upload</option>
        </select>
        <button
          type="button"
          onClick={addCustomField}
          className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
