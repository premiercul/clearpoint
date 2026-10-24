// lib/brandIcon.tsx
// The ClearPoint mark (a white "C" on black) used for the tab icon, the home-screen icons and the app icons.
export function BrandIcon({
  size,
  radius = 0.22,
  glyph = 0.62,
}: {
  size: number
  radius?: number // corner radius as a share of the size (0 = square, e.g. for maskable icons)
  glyph?: number // letter height as a share of the size
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000000',
        color: '#ffffff',
        fontSize: Math.round(size * glyph),
        fontWeight: 700,
        lineHeight: 1,
        borderRadius: Math.round(size * radius),
      }}
    >
      C
    </div>
  )
}
