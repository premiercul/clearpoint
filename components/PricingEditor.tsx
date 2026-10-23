// components/PricingEditor.tsx
'use client'
import { newFieldId } from '@/lib/fields'
import type { PricingMode } from '@/lib/types'

export interface PriceItemDraft {
  id: string
  name: string
  price: string
  description: string
}

interface Props {
  mode: PricingMode
  /** one product per link (vendors): no add/remove buttons */
  single?: boolean
  fixedAmount: string
  setFixedAmount: (v: string) => void
  deliveryFee: string
  setDeliveryFee: (v: string) => void
  items: PriceItemDraft[]
  setItems: (items: PriceItemDraft[]) => void
  extraFee: string
  setExtraFee: (v: string) => void
}

const inputCls = 'w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-black'

export default function PricingEditor(p: Props) {
  const updateItem = (id: string, patch: Partial<PriceItemDraft>) =>
    p.setItems(p.items.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  return (
    <div className="space-y-4">
      {p.mode === 'fixed' && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Amount to pay (₦) *</label>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="any"
            placeholder="e.g., 2000"
            value={p.fixedAmount}
            onChange={(e) => p.setFixedAmount(e.target.value)}
            className={inputCls}
          />
        </div>
      )}

      {p.mode === 'delivery' && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-700">Your delivery fee (₦), the same for every drop-off *</label>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="any"
            placeholder="e.g., 300"
            value={p.deliveryFee}
            onChange={(e) => p.setDeliveryFee(e.target.value)}
            className={inputCls}
          />
          <p className="text-[10px] text-gray-400">
            Payers enter the cost of what they want bought, and see delivery fee + item cost as their total.
          </p>
        </div>
      )}

      {p.mode === 'items' && (
        <div className="space-y-3">
          <div className="space-y-3">
            {p.items.map((it, i) => (
              <div key={it.id} className="space-y-2 p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      {p.single ? 'Product name *' : `Item ${i + 1} name *`}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jollof rice (large)"
                      value={it.name}
                      maxLength={80}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-xs font-medium text-gray-700">Price (₦) *</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="any"
                      placeholder="e.g. 1500"
                      value={it.price}
                      onChange={(e) => updateItem(it.id, { price: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  {!p.single && (
                    <button
                      type="button"
                      onClick={() => p.setItems(p.items.filter((x) => x.id !== it.id))}
                      disabled={p.items.length <= 1}
                      aria-label="Remove item"
                      className="pb-2 text-red-500 text-xs hover:underline disabled:opacity-30"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">
                    {p.single ? 'Product description (optional)' : 'Description (optional)'}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    placeholder="e.g. Comes with plantain and chicken. Ready from 12pm."
                    value={it.description}
                    onChange={(e) => updateItem(it.id, { description: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            ))}
          </div>
          {p.single ? (
            <p className="text-[10px] text-gray-400">
              One product per link. To sell something else, create another link. Customers choose how many they want.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => p.setItems([...p.items, { id: newFieldId(), name: '', price: '', description: '' }])}
              disabled={p.items.length >= 50}
              className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              + Add item
            </button>
          )}
          <div className="space-y-1 pt-2 border-t">
            <label className="text-xs font-medium text-gray-700">Delivery / handling fee (₦), optional</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="Leave empty for none"
              value={p.extraFee}
              onChange={(e) => p.setExtraFee(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      )}
    </div>
  )
}
