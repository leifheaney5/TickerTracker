// Crypto Fear & Greed Index page — /crypto/fear-and-greed
// Displays the daily alternative.me Fear & Greed index with honest attribution.
// No bespoke computations — the value and label come straight from /api/fng.

import { useEffect } from 'react'
import { useStore } from '../state/store'
import { FONT_MONO, FONT_SANS } from '../theme/tokens'

/** Map a 0-100 F&G value to the UI color token that best matches the zone. */
function fngColor(v: number): string {
  if (v <= 25) return 'var(--down)'   // Extreme Fear
  if (v <= 45) return '#ffb347'        // Fear  (--warn)
  if (v < 55)  return 'var(--tx2)'    // Neutral
  if (v < 75)  return '#ffb347'        // Greed (--warn)
  return 'var(--up)'                   // Extreme Greed
}

export function FearAndGreed() {
  const fng = useStore((s) => s.fng)
  const loadFng = useStore((s) => s.loadFng)
  const setView = useStore((s) => s.setView)

  useEffect(() => {
    loadFng()
  }, [loadFng])

  const value = fng?.value ?? null
  const label = fng?.label ?? null
  const color = value !== null ? fngColor(value) : 'var(--tx3)'

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '40px 24px 60px',
        fontFamily: FONT_SANS,
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Page heading */}
        <h1
          style={{
            color: 'var(--tx)',
            fontSize: '26px',
            fontWeight: 800,
            marginBottom: 6,
            lineHeight: 1.25,
          }}
        >
          Crypto Fear &amp; Greed Index
        </h1>
        <p style={{ color: 'var(--tx2)', fontSize: '13.5px', marginBottom: 32, lineHeight: 1.5 }}>
          Published daily by{' '}
          <a
            href="https://alternative.me/crypto/fear-and-greed-index/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            alternative.me
          </a>
          . Ticker Tracker displays this index; we do not compute it.
        </p>

        {/* Score card */}
        <div
          style={{
            textAlign: 'center',
            padding: '44px 24px',
            borderRadius: 18,
            background: 'var(--card)',
            border: '1px solid var(--line)',
            marginBottom: 24,
          }}
        >
          {value === null ? (
            <div style={{ color: 'var(--tx3)', fontSize: '15px' }}>Loading&hellip;</div>
          ) : (
            <>
              <div
                style={{
                  fontSize: '88px',
                  fontWeight: 800,
                  lineHeight: 1,
                  color,
                  fontFamily: FONT_MONO,
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  color,
                  marginTop: 10,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--tx3)', marginTop: 14 }}>
                Score out of 100 &mdash; 0 = Extreme Fear &nbsp;|&nbsp; 100 = Extreme Greed
              </div>
            </>
          )}
        </div>

        {/* What it is */}
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            padding: '20px 22px',
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              color: 'var(--tx)',
              fontSize: '15px',
              fontWeight: 700,
              marginBottom: 10,
              marginTop: 0,
            }}
          >
            What is the Crypto Fear &amp; Greed Index?
          </h2>
          <p
            style={{
              color: 'var(--tx2)',
              fontSize: '13.5px',
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            The Fear &amp; Greed Index is a composite of six factors published daily by{' '}
            <a
              href="https://alternative.me/crypto/fear-and-greed-index/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--tx)', textDecoration: 'underline' }}
            >
              alternative.me
            </a>
            : volatility (25%), market momentum and volume (25%), social media (15%),
            surveys (15%), Bitcoin dominance (10%), and Google Trends (10%). Values near 0
            indicate extreme fear; values near 100 indicate extreme greed. It is an
            informational signal about market sentiment, not a buy or sell recommendation.
          </p>
        </div>

        {/* Attribution + disclaimer */}
        <p
          style={{
            color: 'var(--tx3)',
            fontSize: '12px',
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          Data sourced from the{' '}
          <a
            href="https://api.alternative.me/fng/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--tx2)' }}
          >
            alternative.me API
          </a>
          . This page is for general informational purposes only and is not investment advice.
          Ticker Tracker does not endorse or guarantee the accuracy of this index.
        </p>

        {/* Navigation CTAs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setView('crypto')}
            style={{
              padding: '11px 22px',
              borderRadius: 10,
              background: 'var(--accent)',
              color: '#0a0b0d',
              border: 'none',
              cursor: 'pointer',
              fontFamily: FONT_SANS,
              fontWeight: 700,
              fontSize: '13.5px',
            }}
          >
            Crypto Dashboard
          </button>
          <button
            onClick={() => setView('dashboard')}
            style={{
              padding: '11px 22px',
              borderRadius: 10,
              background: 'var(--card)',
              color: 'var(--tx)',
              border: '1px solid var(--line2)',
              cursor: 'pointer',
              fontFamily: FONT_SANS,
              fontWeight: 600,
              fontSize: '13.5px',
            }}
          >
            Watchlist
          </button>
        </div>
      </div>
    </div>
  )
}
