import { useEffect } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS } from '../theme/tokens'

// SignalChips — surfaces the active F4 smart-signal conditions for the selected symbol.
// Each chip is a named, multi-signal condition (e.g. "Near analyst target", "Overbought +
// bearish news"); hovering/long-pressing shows the exact reading behind it. Honest: nothing
// renders unless a real condition is active, and every chip carries its explanatory detail.

interface Props { symbol: string }

export function SignalChips({ symbol }: Props) {
  const sa = useStore((s) => s.signalAlerts[symbol])
  const load = useStore((s) => s.loadSignalAlerts)

  useEffect(() => { load(symbol) }, [symbol, load])

  if (!sa || sa.conditions.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
      <span style={{ alignSelf: 'center', fontSize: 10.5, letterSpacing: '.04em', color: 'var(--tx3)', fontFamily: FONT_SANS }}>
        SMART SIGNALS
      </span>
      {sa.conditions.map((c) => (
        <span
          key={c.key}
          title={c.detail}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            borderRadius: 999, fontFamily: FONT_SANS, fontSize: 11.5, fontWeight: 600,
            color: 'var(--tx)', background: 'var(--card)',
            border: '1px solid var(--line2)', borderLeft: '3px solid var(--warn)',
          }}
        >
          {c.title}
        </span>
      ))}
    </div>
  )
}
