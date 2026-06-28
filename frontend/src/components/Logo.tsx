import { useState } from 'react'
import { hashStr } from '../lib/hash'
import { resolveLogoDomain } from '../lib/logo'
import { useStore } from '../state/store'

// A rounded tile with a colored monogram underlay and a brand image on top.
// Image source is chosen from an ordered candidate list and degrades gracefully
// on load error:
//   stock:  Finnhub brand logo (real, colored) → Google favicon (by domain) → monogram
//   crypto: cryptocurrency-icons CDN → monogram
// We never guess `<symbol>.com`: a symbol with no known domain and no Finnhub
// logo shows the monogram rather than a wrong/placeholder favicon.

interface LogoProps {
  symbol: string
  size?: number
  kind?: 'stock' | 'crypto'
  /** Company website (any form); overrides the curated domain map. */
  domain?: string
}

export function Logo({ symbol, size = 28, kind = 'stock', domain }: LogoProps) {
  // Track the srcs that have failed to load so we can advance to the next
  // candidate. A Set (vs a single boolean) is robust to the Finnhub logo URL
  // arriving asynchronously after first paint.
  const [failed, setFailed] = useState<Record<string, true>>({})
  const finnhubLogo = useStore((s) => s.logos[symbol])
  const r = Math.max(5, Math.round(size * 0.26))
  const initials = kind === 'crypto' ? symbol.slice(0, 3) : symbol.slice(0, 2)
  const hue = hashStr(symbol) % 360

  const candidates: string[] =
    kind === 'crypto'
      ? symbol === 'TAO'
        ? []
        : [`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`]
      : [
          finnhubLogo || '',
          ...(() => {
            const d = resolveLogoDomain(symbol, domain)
            return d ? [`https://www.google.com/s2/favicons?domain=${d}&sz=128`] : []
          })(),
        ].filter(Boolean)

  const src = candidates.find((c) => !failed[c]) ?? null
  const imgBg = kind === 'crypto' ? 'transparent' : '#fff'

  return (
    <div
      style={{
        position: 'relative', width: size, height: size, borderRadius: r,
        overflow: 'hidden', flex: '0 0 auto', background: `hsl(${hue},30%,20%)`,
      }}
    >
      <span
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontFamily: "'Sora',sans-serif", fontWeight: 700,
          fontSize: size * 0.34, color: `hsl(${hue},55%,70%)`, letterSpacing: '-.02em',
        }}
      >
        {initials}
      </span>
      {src && (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed((f) => ({ ...f, [src]: true }))}
          style={{
            position: 'relative', display: 'block', width: '100%', height: '100%',
            objectFit: 'contain', background: imgBg, padding: kind === 'crypto' ? '0' : '2px',
          }}
        />
      )}
    </div>
  )
}
