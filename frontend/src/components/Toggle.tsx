import { COLORS } from '../theme/tokens'

// iOS-style toggle switch matching the prototype's settings toggles.
export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 44, height: 26, borderRadius: 13, flex: '0 0 auto', cursor: 'pointer',
        background: on ? COLORS.accent : 'rgba(255,255,255,.14)', transition: 'background .15s', position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%',
          background: '#fff', transition: 'left .15s',
        }}
      />
    </div>
  )
}
