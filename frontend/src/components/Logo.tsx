import { useState } from 'react'
import { DOMAINS } from '../data/universe'
import { hashStr } from '../lib/hash'

// Ported from the prototype's _logo: a rounded tile with a colored monogram
// underlay and a CDN logo image on top (DuckDuckGo for stocks, cryptocurrency-
// icons for coins) that hides itself on error, revealing the monogram.

interface LogoProps {
  symbol: string
  size?: number
  kind?: 'stock' | 'crypto'
}

export function Logo({ symbol, size = 28, kind = 'stock' }: LogoProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const r = Math.max(5, Math.round(size * 0.26))
  const initials = kind === 'crypto' ? symbol.slice(0, 3) : symbol.slice(0, 2)
  const hue = hashStr(symbol) % 360
  const src =
    kind === 'crypto'
      ? `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`
      : `https://icons.duckduckgo.com/ip3/${DOMAINS[symbol] || symbol.toLowerCase() + '.com'}.ico`
  const imgBg = kind === 'crypto' ? 'transparent' : '#fff'
  const skip = kind === 'crypto' && symbol === 'TAO'

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
