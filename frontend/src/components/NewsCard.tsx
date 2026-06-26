import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { COLORS, FONT_SANS } from '../theme/tokens'
import type { Sentiment } from '../api/types'

// News card — ported from the prototype template (lines 371-392). Per-symbol /
// Market toggle; each item shows source · timestamp, a sentiment pill, and the
// headline. Data from /api/news (Finnhub or mock).

const SENT_STYLE: Record<Sentiment, { bg: string; color: string }> = {
  Bullish: { bg: 'rgba(61,220,132,.12)', color: COLORS.up },
  Bearish: { bg: 'rgba(255,93,115,.12)', color: COLORS.down },
  Neutral: { bg: 'rgba(154,161,171,.12)', color: COLORS.tx2 },
}

// Only allow http(s) URLs into the anchor href — blocks javascript:/data: XSS
// vectors from the (externally sourced) news URL field.
function safeHref(url: string): string | undefined {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

export function NewsCard() {
  const selected = useStore((s) => s.selected)
  const news = useStore((s) => s.news)
  const loadNews = useStore((s) => s.loadNews)
  const [tab, setTab] = useState<'sym' | 'market'>('sym')

  useEffect(() => {
    if (tab === 'sym') loadNews(selected)
    else loadNews(undefined)
  }, [tab, selected, loadNews])

  const items = tab === 'sym' ? news[selected] || [] : news['MARKET'] || []

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: FONT_SANS,
    fontSize: '12px', fontWeight: active ? 600 : 500,
    background: active ? COLORS.cardHi : 'transparent', color: active ? COLORS.tx : COLORS.tx3,
  })

  return (
    <div style={{ width: 392, flex: '1 1 320px', background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '18px 18px 10px', display: 'flex', flexDirection: 'column', minWidth: 300 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-.01em', color: COLORS.tx }}>News</span>
        <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 9, background: COLORS.bg }}>
          <button onClick={() => setTab('sym')} style={tabStyle(tab === 'sym')}>{selected}</button>
          <button onClick={() => setTab('market')} style={tabStyle(tab === 'market')}>Market</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((n, i) => {
          const ss = SENT_STYLE[n.sentiment]
          return (
            <a
              key={i}
              href={safeHref(n.url)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '13px 4px', borderTop: `1px solid ${COLORS.line}`, cursor: 'pointer', textDecoration: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: '11px', color: COLORS.tx3 }}>{n.source} · {n.datetime}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color }}>{n.sentiment}</span>
              </div>
              <span style={{ fontSize: '13px', lineHeight: 1.4, color: COLORS.tx, textWrap: 'pretty' } as React.CSSProperties}>{n.headline}</span>
            </a>
          )
        })}
        {items.length === 0 && <div style={{ padding: '24px 4px', color: COLORS.tx3, fontSize: 12 }}>Loading news…</div>}
      </div>
    </div>
  )
}
