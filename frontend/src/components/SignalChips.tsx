import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { FONT_SANS } from '../theme/tokens'

// SignalChips — surfaces the active F4 smart-signal conditions for the selected symbol.
// Each chip is a named, multi-signal condition (e.g. "Near analyst target", "Overbought +
// bearish news"). The chip detail (previously hover-only via `title`) is now accessible to
// keyboard, screen-reader, and touch users via a role="tooltip" region that appears on
// focus or hover (WCAG 1.3.1 / 2.5.3).

interface Props { symbol: string }

export function SignalChips({ symbol }: Props) {
  const sa = useStore((s) => s.signalAlerts[symbol])
  const load = useStore((s) => s.loadSignalAlerts)
  // Key of the chip whose tooltip is currently visible (null = none).
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => { load(symbol) }, [symbol, load])

  if (!sa || sa.conditions.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
      <span
        style={{
          alignSelf: 'center', fontSize: 10.5, letterSpacing: '.04em',
          color: 'var(--tx3)', fontFamily: FONT_SANS,
        }}
      >
        SMART SIGNALS
      </span>

      {sa.conditions.map((c) => {
        const tooltipId = `signal-chip-tooltip-${c.key}`
        const isActive = activeKey === c.key

        return (
          <div
            key={c.key}
            style={{ position: 'relative', display: 'inline-flex' }}
          >
            {/* Chip is a button so it is natively focusable and keyboard-operable. */}
            <button
              type="button"
              data-testid={`signal-chip-${c.key}`}
              aria-describedby={tooltipId}
              onMouseEnter={() => setActiveKey(c.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(c.key)}
              onBlur={() => setActiveKey(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999,
                fontFamily: FONT_SANS, fontSize: 11.5, fontWeight: 600,
                color: 'var(--tx)', background: 'var(--card)',
                border: '1px solid var(--line2)', borderLeft: '3px solid var(--warn)',
                cursor: 'default',
                // Reset browser button defaults
                appearance: 'none' as React.CSSProperties['appearance'],
              }}
            >
              {c.title}
            </button>

            {/* Tooltip — visible on hover and keyboard focus; always in DOM for
                aria-describedby but visually hidden when inactive. */}
            <span
              id={tooltipId}
              role="tooltip"
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'max-content',
                maxWidth: 240,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'var(--panel)',
                border: '1px solid var(--line2)',
                boxShadow: '0 4px 16px rgba(0,0,0,.5)',
                fontFamily: FONT_SANS,
                fontSize: 11.5,
                color: 'var(--tx2)',
                lineHeight: 1.5,
                pointerEvents: 'none',
                zIndex: 20,
                // Visually hide (but keep accessible) when not active.
                opacity: isActive ? 1 : 0,
                visibility: isActive ? 'visible' : 'hidden',
                transition: 'opacity 0.12s ease',
                whiteSpace: 'normal',
              }}
            >
              {c.detail}
            </span>
          </div>
        )
      })}
    </div>
  )
}
