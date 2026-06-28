// ShortcutsHelp — keyboard shortcuts help overlay.
// Controlled by open/onClose props. Clicking the backdrop or pressing Escape
// closes it (Escape is also handled in useKeyboardShortcuts, but the backdrop
// click covers pointer users).

import { FONT_SANS, FONT_MONO } from '../theme/tokens'

interface Props {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: { keys: string[]; desc: string }[] = [
  { keys: ['/'], desc: 'Focus search' },
  { keys: ['?'], desc: 'Toggle this help overlay' },
  { keys: ['g', 'd'], desc: 'Go to Dashboard' },
  { keys: ['g', 'w'], desc: 'Go to Manage Watchlist' },
  { keys: ['g', 's'], desc: 'Go to Screener' },
  { keys: ['g', 'c'], desc: 'Go to Crypto' },
  { keys: ['g', 'm'], desc: 'Go to Market' },
  { keys: ['Esc'], desc: 'Close this overlay' },
]

function KBD({ children }: { children: string }) {
  return (
    <kbd
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 24, height: 22, padding: '0 6px',
        borderRadius: 5, border: '1px solid var(--line2)',
        background: 'var(--card)', color: 'var(--tx)',
        fontFamily: FONT_MONO, fontSize: '11.5px', fontWeight: 600,
        lineHeight: 1, letterSpacing: 0,
      }}
    >
      {children}
    </kbd>
  )
}

export function ShortcutsHelp({ open, onClose }: Props) {
  if (!open) return null

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
      }}
    >
      {/* Card — stop propagation so clicking inside doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--line2)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,.6)',
          padding: '24px 28px 28px',
          minWidth: 320,
          maxWidth: 420,
          width: '90vw',
          color: 'var(--tx)',
          fontFamily: FONT_SANS,
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--tx)' }}>
            Keyboard shortcuts
          </span>
          <button
            onClick={onClose}
            aria-label="Close shortcuts help"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--tx3)', fontSize: '18px', lineHeight: 1, padding: 2,
            }}
          >
            ×
          </button>
        </div>

        {/* Shortcuts table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SHORTCUTS.map((s, i) => (
              <tr
                key={i}
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                }}
              >
                <td style={{ padding: '9px 0', width: 90 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {s.keys.map((k, ki) => (
                      <span key={ki} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {ki > 0 && (
                          <span style={{ fontSize: '10px', color: 'var(--tx3)', margin: '0 1px' }}>then</span>
                        )}
                        <KBD>{k}</KBD>
                      </span>
                    ))}
                  </span>
                </td>
                <td style={{ padding: '9px 0 9px 12px', fontSize: '13px', color: 'var(--tx2)' }}>
                  {s.desc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ margin: '16px 0 0', fontSize: '11.5px', color: 'var(--tx3)', lineHeight: 1.5 }}>
          Shortcuts are disabled while typing in inputs or search.
        </p>
      </div>
    </div>
  )
}
