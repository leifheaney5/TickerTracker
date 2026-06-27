import { useState } from 'react'
import { hashStr } from '../lib/hash'
import { resolveLogoDomain } from '../lib/logo'

// Ported from the prototype's _logo: a rounded tile with a colored monogram
// underlay and a CDN logo image on top (DuckDuckGo for stocks, cryptocurrency-
// icons for coins) that hides itself on error, revealing the monogram. For
// stocks we only show the image when we actually know the company's domain
// (curated map or the `domain` override from fundamentals); otherwise the
// monogram stands alone rather than guessing a wrong `<symbol>.com` favicon.

interface LogoProps {
  symbol: string
  size?: number
  kind?: 'stock' | 'crypto'
  /** Company website (any form); overrides the curated domain map. */
  domain?: string
}

export function Logo({ symbol, size = 28, kind = 'stock', domain }: LogoProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const r = Math.max(5, Math.round(size * 0.26))
  const initials = kind === 'crypto' ? symbol.slice(0, 3) : symbol.slice(0, 2)
  const hue = hashStr(symbol) % 360
  const stockDomain = kind === 'crypto' ? null : resolveLogoDomain(symbol, domain)
  const src =
    kind === 'crypto'
      ? `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`
      : stockDomain
        ? // Google's favicon service: colored, higher-res, and broader coverage
          // than DuckDuckGo's ip3 (which returned grayscale/empty/text for some
          // domains, e.g. a dark KO box, blank Adobe, text Spotify).
          `https://www.google.com/s2/favicons?domain=${stockDomain}&sz=128`
        : ''
  const imgBg = kind === 'crypto' ? 'transparent' : '#fff'
  const skip = (kind === 'crypto' && symbol === 'TAO') || (kind === 'stock' && !stockDomain)

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
      {!skip && !imgFailed && (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          style={{
            position: 'relative', display: 'block', width: '100%', height: '100%',
            objectFit: 'contain', background: imgBg, padding: kind === 'crypto' ? '0' : '2px',
          }}
        />
      )}
    </div>
  )
}
