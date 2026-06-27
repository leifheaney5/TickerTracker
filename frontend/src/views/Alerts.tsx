import { useStore, isAuthed } from '../state/store'
import { COLORS, FONT_SANS } from '../theme/tokens'
import { Logo } from '../components/Logo'
import { money } from '../lib/format'

// Alerts view — ported from the prototype template (lines 1049-1091). Active
// alerts come from watchlist items with alert_price > 0; triggered ones (current
// price has crossed the alert in the configured direction) show a HIT badge.
export function Alerts() {
  const watchlist = useStore((s) => s.watchlist)
  const price = useStore((s) => s.price)
  const setSelected = useStore((s) => s.setSelected)
  const setView = useStore((s) => s.setView)
  const updateWatch = useStore((s) => s.updateWatch)
  const authed = useStore(isAuthed)
  const openAuth = useStore((s) => s.openAuth)

  const active = watchlist.filter((w) => w.alert_price > 0)
  const open = (sym: string) => { setSelected(sym); setView('dashboard') }

  const card: React.CSSProperties = { background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>Alerts</span>
          <span style={{ fontSize: '13px', color: COLORS.tx2 }}>Price alerts you've set, and the symbols you're watching</span>
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: COLORS.tx }}>Active alerts</span>
            <span style={{ fontSize: '11.5px', color: COLORS.tx3 }}>{active.length} active</span>
          </div>
          {active.map((a) => {
            const cur = price(a.symbol)
            const hit = a.alert_dir === 'above' ? cur >= a.alert_price : cur <= a.alert_price
            const cond = a.alert_dir === 'above' ? `Rises to ${money(a.alert_price)}` : `Falls to ${money(a.alert_price)}`
            return (
              <div key={a.symbol} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: `1px solid ${COLORS.line}` }}>
                <Logo symbol={a.symbol} size={30} />
                <div onClick={() => open(a.symbol)} style={{ flex: 1, minWidth: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: COLORS.tx }}>{a.symbol}</span>
                    {hit && <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.04em', color: COLORS.accent, border: `1px solid ${COLORS.accent}`, borderRadius: 5, padding: '1px 5px' }}>HIT</span>}
                  </div>
                  <span style={{ fontSize: '12px', color: COLORS.tx2 }}>{cond} · now {money(cur)}</span>
                </div>
                <button
                  onClick={() => updateWatch(a.symbol, { alert_price: 0 })}
                  style={{ height: 32, padding: '0 13px', borderRadius: 8, border: `1px solid ${COLORS.line2}`, background: 'transparent', color: COLORS.tx2, fontFamily: FONT_SANS, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            )
          })}
          {active.length === 0 && (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: COLORS.tx3, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              {authed ? (
                <span>No alerts yet — set a price target on a watchlist ticker to get notified.</span>
              ) : (
                <>
                  <span>Sign in to save alerts across devices.</span>
                  <button onClick={() => openAuth('login')} style={{ height: 32, padding: '0 14px', borderRadius: 8, border: 'none', background: COLORS.accent, color: COLORS.accentInk, fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Sign in</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
