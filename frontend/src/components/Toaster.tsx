import { useToastStore, type Toast } from '../state/toastStore'
import { FONT_SANS } from '../theme/tokens'

// Colour palette by toast kind
const KIND_STYLE: Record<Toast['kind'], React.CSSProperties> = {
  info: {
    background: 'var(--card)',
    border: '1px solid var(--line2)',
    color: 'var(--tx)',
  },
  success: {
    background: 'rgba(61,220,132,.15)',
    border: '1px solid var(--up)',
    color: 'var(--up)',
  },
  alert: {
    background: 'rgba(255,170,0,.12)',
    border: '1px solid rgba(255,170,0,.7)',
    color: '#ffaa00',
  },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useToastStore((s) => s.dismissToast)
  return (
    <div
      data-testid="toast"
      role="status"
      aria-live="polite"
      style={{
        ...KIND_STYLE[toast.kind],
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 16px', borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,.28)',
        fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600,
        minWidth: 220, maxWidth: 380,
        animation: 'tt-toast-in 0.2s ease',
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
        style={{
          flexShrink: 0, background: 'transparent', border: 'none',
          color: 'inherit', cursor: 'pointer', fontSize: '15px',
          lineHeight: 1, padding: '0 2px', opacity: 0.7,
        }}
      >
        ×
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  if (!toasts.length) return null
  return (
    <>
      <style>{`
        @keyframes tt-toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          display: 'flex', flexDirection: 'column', gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} />
          </div>
        ))}
      </div>
    </>
  )
}
