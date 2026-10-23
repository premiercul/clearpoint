// lib/fields.ts
function getCrypto(): Crypto | undefined {
  return typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined
}

export function newFieldId(): string {
  const c = getCrypto()
  if (c && typeof c.randomUUID === 'function') return `f_${c.randomUUID().slice(0, 8)}`
  return `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Lowercase UUID v4 that also works on plain-http pages (crypto.randomUUID needs https/localhost). */
export function uuid(): string {
  const c = getCrypto()
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
