// Footer — a slim production footer bar with © line + Help and Contact links
// that open modal overlays (matching the ShortcutsHelp / AuthScreen pattern).

import { useState } from 'react'
import { FONT_SANS } from '../theme/tokens'

const SUPPORT_EMAIL = 'support@tickertracker.info'
const YEAR = new Date().getFullYear()

// ── Shared modal shell ───────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,.6)', padding: '24px 28px 28px',
          minWidth: 320, maxWidth: 520, width: '92vw', maxHeight: '82vh', overflowY: 'auto',
          color: 'var(--tx)', fontFamily: FONT_SANS,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--tx)' }}>{title}</span>
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--tx3)', fontSize: '18px', lineHeight: 1, padding: 2 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Help content ─────────────────────────────────────────────────────────────
const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is Ticker Tracker?',
    a: 'A clean, dark dashboard for tracking the stocks and crypto you care about — watchlists with price targets and alerts, interactive charts, key stats, news with sentiment, analyst ratings, a market map, and a crypto Fear & Greed index.',
  },
  {
    q: 'Do I need an account?',
    a: 'No — you can browse everything free. A free account is only needed to save your own watchlist, set price targets and alerts, and track a portfolio. Sign up with email or Google.',
  },
  {
    q: 'How do price alerts work?',
    a: 'On the Manage Watchlist screen, set an alert price on any ticker and toggle it ON. We check prices every few minutes and email you when a ticker crosses your target.',
  },
  {
    q: 'Is the market data real?',
    a: 'Yes — live quotes, fundamentals, news, analyst ratings, crypto prices, and the Fear & Greed index all come from real providers (Finnhub, Yahoo, CoinGecko, alternative.me). Some figures may be delayed depending on the source.',
  },
  {
    q: 'Keyboard shortcuts?',
    a: 'Press “/” to search, “g” then a letter to jump between views, and “?” any time to see the full shortcut list.',
  },
  {
    q: 'Is Ticker Tracker financial advice?',
    a: 'No. Ticker Tracker is an informational tool only and does not provide investment, financial, or trading advice. Always do your own research.',
  },
]

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Help & FAQ" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {FAQ.map((f, i) => (
          <div key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)', paddingTop: i === 0 ? 0 : 14 }}>
            <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'var(--tx)' }}>{f.q}</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', lineHeight: 1.55, color: 'var(--tx2)' }}>{f.a}</p>
          </div>
        ))}
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--tx3)' }}>
          Still stuck? Reach us via the <strong>Contact</strong> link below.
        </p>
      </div>
    </Modal>
  )
}

// ── Contact content ──────────────────────────────────────────────────────────
function ContactModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Contact us" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.55, color: 'var(--tx2)' }}>
          Questions, feedback, or a bug to report? We’d love to hear from you.
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Ticker%20Tracker%20support`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 42, padding: '0 18px', borderRadius: 10, textDecoration: 'none',
            background: 'var(--accent)', color: 'var(--accentInk)',
            fontFamily: FONT_SANS, fontWeight: 700, fontSize: '14px',
          }}
        >
          ✉ Email {SUPPORT_EMAIL}
        </a>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--tx3)', lineHeight: 1.5 }}>
          Or copy our address: <span style={{ color: 'var(--tx2)' }}>{SUPPORT_EMAIL}</span>. We typically reply within a couple of business days.
        </p>
      </div>
    </Modal>
  )
}

// ── Footer bar ───────────────────────────────────────────────────────────────
export function Footer() {
  const [open, setOpen] = useState<null | 'help' | 'contact'>(null)

  const linkStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '12px', padding: 0,
  }

  return (
    <>
      <footer
        style={{
          flex: '0 0 auto', height: 34, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 14, padding: '0 16px',
          borderTop: '1px solid var(--line)', background: 'var(--panel)',
          fontFamily: FONT_SANS, fontSize: '12px', color: 'var(--tx3)',
        }}
      >
        <span style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 9 }}>
          © {YEAR} Ticker Tracker™
          <span style={{ color: 'var(--line2)' }}>·</span>
          <span style={{ color: 'var(--tx2)', fontWeight: 600 }}>Signal, not noise.</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button style={linkStyle} onClick={() => setOpen('help')}>Help</button>
          <button style={linkStyle} onClick={() => setOpen('contact')}>Contact</button>
          <span style={{ color: 'var(--tx3)', fontSize: '11px' }}>Informational only — not financial advice.</span>
        </span>
      </footer>

      {open === 'help' && <HelpModal onClose={() => setOpen(null)} />}
      {open === 'contact' && <ContactModal onClose={() => setOpen(null)} />}
    </>
  )
}
