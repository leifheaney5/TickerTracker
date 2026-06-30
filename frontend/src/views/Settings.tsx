import { useStore, isAuthed } from '../state/store'
import { FONT_SANS } from '../theme/tokens'
import { Toggle } from '../components/Toggle'
import { api } from '../api/client'
import { usePushSubscription } from '../hooks/usePushSubscription'
import { useTwoFactor } from '../hooks/useTwoFactor'
import { usePasskey } from '../hooks/usePasskey'

// Settings view — ported from the prototype template (lines 1184-1272): profile
// header, account details, connected accounts (brokerage connect/disconnect),
// notifications & data toggles, privacy, sign out. Wired to /api/settings.
export function Settings() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const holdings = useStore((s) => s.holdings)
  const authed = useStore(isAuthed)
  const currentUser = useStore((s) => s.currentUser)
  const logout = useStore((s) => s.logout)
  const openAuth = useStore((s) => s.openAuth)
  const billing = useStore((s) => s.billing)
  const openUpgrade = useStore((s) => s.openUpgrade)

  // Anonymous users have no settings — prompt sign-in instead of a stuck spinner.
  if (!authed) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
        <div style={{ maxWidth: 480, margin: '48px auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ fontSize: '21px', fontWeight: 800, color: 'var(--tx)' }}>Settings</span>
          <span style={{ fontSize: '13.5px', color: 'var(--tx2)', lineHeight: 1.5 }}>Create a free account or sign in to manage your profile, connect a brokerage, and set preferences.</span>
          <button onClick={() => openAuth('login')} style={{ height: 40, padding: '0 20px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '13.5px', fontWeight: 700, cursor: 'pointer' }}>Sign in / Sign up</button>
        </div>
      </div>
    )
  }

  if (!settings) return <div style={{ flex: 1, padding: 24, color: 'var(--tx3)' }}>Loading…</div>

  const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16 }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderTop: '1px solid var(--line)' }

  const toggleRow = (title: string, sub: string, key: keyof typeof settings) => (
    <div style={row}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--tx)' }}>{title}</span>
        <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>{sub}</span>
      </div>
      <Toggle on={!!settings[key]} onClick={() => updateSettings({ [key]: !settings[key] } as Partial<typeof settings>)} />
    </div>
  )

  const { isSubscribed, isSupported, permissionState, toggle: togglePush, busy: pushBusy } =
    usePushSubscription()

  const twoFactor = useTwoFactor()
  const passkey = usePasskey()

  const startCheckout = async (interval: 'monthly' | 'annual') => {
    try {
      const { data } = await api.checkout(interval)
      location.href = data.url
    } catch { /* billing may be disabled pre-launch */ }
  }
  const openPortal = async () => {
    try {
      const { data } = await api.portal()
      location.href = data.url
    } catch { /* ignore */ }
  }

  const usageRow = (label: string, used: number, limit: number) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 0' }}>
      <span style={{ fontSize: '12.5px', color: 'var(--tx2)' }}>{label}</span>
      <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--tx)' }}>{used} / {limit}</span>
    </div>
  )

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mpad,22px 26px)' }}>
      <div style={{ maxWidth: 740, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '21px', fontWeight: 800, letterSpacing: '-.02em', color: 'var(--tx)' }}>Settings</span>
          <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>Manage your account, connections, and preferences</span>
        </div>

        <div style={{ ...card, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#2a2f38,#171a1f)', border: '1px solid var(--line2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '19px', fontWeight: 700, color: 'var(--tx)', flex: '0 0 auto' }}>
            {authed && currentUser
              ? (currentUser.name
                  ? currentUser.name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
                  : currentUser.email.slice(0, 2).toUpperCase())
              : 'JD'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--tx)' }}>
              {authed && currentUser ? (currentUser.name || currentUser.email) : 'Jordan Doe'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--tx2)' }}>
              {authed && currentUser ? currentUser.email : 'jordan.doe@email.com'}
            </span>
            {authed && currentUser && (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: currentUser.email_verified ? 'var(--up)' : 'var(--warn)' }}>
                {currentUser.email_verified ? '✓ Email verified' : '⚠ Email not verified'}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {billing && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: billing.is_pro ? 'rgba(61,220,132,.1)' : 'var(--cardHi)', fontSize: '12px', fontWeight: 600, color: billing.is_pro ? 'var(--accent)' : 'var(--tx2)' }}>{billing.is_pro ? '◆ Pro plan' : 'Free plan'}</span>
          )}
        </div>

        {billing && (
          <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Plan &amp; Billing</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: billing.is_pro ? 'rgba(61,220,132,.12)' : 'var(--cardHi)', fontSize: '12px', fontWeight: 700, color: billing.is_pro ? 'var(--accent)' : 'var(--tx2)' }}>
                {billing.is_pro ? '◆ Pro' : 'Free'}
              </span>
            </div>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
              {usageRow('Watchlist tickers', billing.usage.watchlist, billing.limits.watchlist)}
              {usageRow('Active price alerts', billing.usage.alerts, billing.limits.alerts)}
              {usageRow('Saved screeners', billing.usage.screens, billing.limits.screens)}
            </div>
            {billing.is_pro ? (
              <button onClick={openPortal} style={{ alignSelf: 'flex-start', height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Manage billing</button>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => startCheckout('annual')} style={{ height: 40, padding: '0 18px', borderRadius: 11, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '13.5px', fontWeight: 800, cursor: 'pointer' }}>Upgrade yearly — $59/yr</button>
                <button onClick={() => startCheckout('monthly')} style={{ height: 40, padding: '0 16px', borderRadius: 11, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Monthly — $7/mo</button>
              </div>
            )}
          </div>
        )}

        <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Connected accounts</span>
          <span style={{ fontSize: '12px', color: 'var(--tx3)', lineHeight: 1.55 }}>Your portfolio value is calculated from holdings synced via a connected brokerage — Ticker Tracker never moves your money. Connect an account to track real balances.</span>
          {settings.broker_connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--line)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(61,220,132,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: '17px', fontWeight: 800, flex: '0 0 auto' }}>↗</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--tx)' }}>{settings.broker_name || 'Connected brokerage'}</span>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--up)' }}>● Connected · {holdings.length} holdings synced</span>
              </div>
              <button onClick={() => updateSettings({ broker_connected: false, broker_name: '' })} style={{ height: 34, padding: '0 14px', borderRadius: 9, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Disconnect</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderRadius: 12, background: 'var(--bg)', border: '1px dashed var(--line2)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--cardHi)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: '18px', flex: '0 0 auto' }}>⊕</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--tx)' }}>No brokerage connected</span>
                <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>Portfolio value is hidden until an account is linked</span>
              </div>
              <button onClick={() => updateSettings({ broker_connected: true, broker_name: 'Demo Brokerage' })} style={{ height: 34, padding: '0 16px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Connect</button>
            </div>
          )}
        </div>

        <div style={{ ...card, padding: '6px 22px 14px' }}>
          <div style={{ padding: '16px 0 2px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Notifications &amp; data</span></div>
          {toggleRow('Live price updates', 'Continuously stream prices and sparklines', 'live_updates')}
          {toggleRow('Price alert notifications', 'Pop a toast the moment a target is hit', 'alert_notifs')}
          {(billing?.is_pro ?? true)
            ? toggleRow('Weekly market digest', 'Email summary of your watchlist every Monday', 'news_digest')
            : (
              <div style={row}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--tx)' }}>Weekly market digest <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>· Pro</span></span>
                  <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>Email summary of your watchlist every Monday</span>
                </div>
                <button onClick={() => openUpgrade('digest', 'The weekly market digest is a Pro feature.')} style={{ height: 32, padding: '0 13px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Upgrade</button>
              </div>
            )}

          {/* Web push notifications */}
          <div style={row}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--tx)' }}>Browser push notifications</span>
              <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>
                {!isSupported
                  ? 'Not supported in this browser'
                  : permissionState === 'denied'
                    ? 'Permission denied — allow notifications in browser settings'
                    : 'Get instant alerts in your browser when price targets are hit'}
              </span>
            </div>
            {isSupported && permissionState !== 'denied' ? (
              <div
                data-testid="push-notif-toggle"
                style={{ opacity: pushBusy ? 0.5 : 1, pointerEvents: pushBusy ? 'none' : 'auto' }}
              >
                <Toggle on={isSubscribed} onClick={togglePush} />
              </div>
            ) : (
              <span style={{ fontSize: '11.5px', color: 'var(--tx3)', fontStyle: 'italic' }}>
                {!isSupported ? 'Unavailable' : 'Blocked'}
              </span>
            )}
          </div>
        </div>

        <div style={{ ...card, padding: '6px 22px 14px' }}>
          <div style={{ padding: '16px 0 2px' }}><span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Privacy &amp; display</span></div>
          {toggleRow('Hide balances', 'Mask your portfolio value across the app', 'hide_balances')}
        </div>

        {/* ── Security ────────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Security</span>

          {/* 2FA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--tx)' }}>Two-factor authentication (TOTP)</span>
                <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>
                  {twoFactor.status === 'enabled'
                    ? 'Authenticator app is active'
                    : twoFactor.status === 'disabled'
                    ? 'Add an extra layer of login security'
                    : 'Loading…'}
                </span>
              </div>
              {twoFactor.status === 'disabled' && (
                <button
                  data-testid="2fa-enable-btn"
                  onClick={twoFactor.startSetup}
                  disabled={twoFactor.busy}
                  style={{ height: 34, padding: '0 16px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', opacity: twoFactor.busy ? 0.6 : 1 }}
                >
                  Enable
                </button>
              )}
              {twoFactor.status === 'enabled' && (
                <button
                  data-testid="2fa-disable-btn"
                  onClick={twoFactor.promptDisable}
                  disabled={twoFactor.busy}
                  style={{ height: 34, padding: '0 16px', borderRadius: 9, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: twoFactor.busy ? 0.6 : 1 }}
                >
                  Disable
                </button>
              )}
            </div>

            {/* Setup flow: QR + code input */}
            {twoFactor.setupData && (
              <div data-testid="2fa-setup-panel" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: '12.5px', color: 'var(--tx2)', lineHeight: 1.5 }}>
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code below to confirm.
                </span>
                {/* QR code rendered via img from data URI or an inline SVG.
                    We use the otpauth_uri directly — pass it to a QR generator if the qrcode dep is available. */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <TotpQrCode uri={twoFactor.setupData.otpauth_uri} />
                  <span style={{ fontSize: '10.5px', color: 'var(--tx3)', wordBreak: 'break-all', textAlign: 'center', maxWidth: 280 }}>
                    Manual key: <strong style={{ color: 'var(--tx2)' }}>{twoFactor.setupData.secret}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    data-testid="2fa-confirm-code"
                    style={{ flex: 1, height: 40, padding: '0 14px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_SANS, fontSize: '16px', textAlign: 'center', letterSpacing: '.2em' }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={twoFactor.confirmCode}
                    onChange={e => twoFactor.setConfirmCode(e.target.value)}
                  />
                  <button
                    data-testid="2fa-confirm-btn"
                    onClick={twoFactor.confirmEnable}
                    disabled={twoFactor.busy || twoFactor.confirmCode.length < 6}
                    style={{ height: 40, padding: '0 18px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (twoFactor.busy || twoFactor.confirmCode.length < 6) ? 0.6 : 1 }}
                  >
                    Confirm
                  </button>
                </div>
                {twoFactor.error && (
                  <span style={{ fontSize: '12px', color: 'var(--down)' }}>{twoFactor.error}</span>
                )}
              </div>
            )}

            {/* Recovery codes — shown once after setup */}
            {twoFactor.recoveryCodes && twoFactor.recoveryCodes.length > 0 && (
              <div data-testid="recovery-codes-panel" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Save your recovery codes</span>
                <span style={{ fontSize: '12px', color: 'var(--tx2)', lineHeight: 1.5 }}>
                  These codes let you log in if you lose access to your authenticator app. Each code can only be used once. Store them somewhere safe.
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line)' }}>
                  {twoFactor.recoveryCodes.map(c => (
                    <span key={c} style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--tx)', letterSpacing: '.05em' }}>{c}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    data-testid="recovery-codes-copy"
                    onClick={() => navigator.clipboard.writeText(twoFactor.recoveryCodes!.join('\n')).catch(() => undefined)}
                    style={{ height: 34, padding: '0 14px', borderRadius: 9, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Copy all
                  </button>
                  <button
                    data-testid="recovery-codes-done"
                    onClick={twoFactor.dismissRecoveryCodes}
                    style={{ height: 34, padding: '0 16px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'var(--accentInk)', fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    I've saved them
                  </button>
                </div>
              </div>
            )}

            {/* Disable flow: confirm code prompt */}
            {twoFactor.showDisablePrompt && (
              <div data-testid="2fa-disable-panel" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: '12.5px', color: 'var(--tx2)' }}>Enter your current TOTP code (or a recovery code) to disable 2FA:</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    data-testid="2fa-disable-code"
                    style={{ flex: 1, height: 40, padding: '0 14px', borderRadius: 9, border: '1px solid var(--line2)', background: 'var(--bg)', color: 'var(--tx)', fontFamily: FONT_SANS, fontSize: '15px', textAlign: 'center', letterSpacing: '.1em' }}
                    type="text"
                    placeholder="000000 or XXXX-XXXX-XXXX"
                    value={twoFactor.confirmCode}
                    onChange={e => twoFactor.setConfirmCode(e.target.value)}
                  />
                  <button
                    data-testid="2fa-disable-confirm"
                    onClick={twoFactor.confirmDisable}
                    disabled={twoFactor.busy || !twoFactor.confirmCode}
                    style={{ height: 40, padding: '0 18px', borderRadius: 9, border: '1px solid var(--down)', background: 'transparent', color: 'var(--down)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (twoFactor.busy || !twoFactor.confirmCode) ? 0.6 : 1 }}
                  >
                    Disable
                  </button>
                </div>
                {twoFactor.error && (
                  <span style={{ fontSize: '12px', color: 'var(--down)' }}>{twoFactor.error}</span>
                )}
              </div>
            )}
          </div>

          {/* Passkey / biometric */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--tx)' }}>Passkeys / biometric login</span>
                <span style={{ fontSize: '11.5px', color: 'var(--tx3)' }}>
                  {!passkey.serverEnabled
                    ? 'Not available on this server'
                    : !passkey.browserSupported
                    ? 'Not supported in this browser'
                    : 'Log in with Face ID, Touch ID, or a hardware key'}
                </span>
              </div>
              {passkey.serverEnabled && passkey.browserSupported && (
                <button
                  data-testid="passkey-register"
                  onClick={passkey.register}
                  disabled={passkey.busy}
                  style={{ height: 34, padding: '0 16px', borderRadius: 9, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: passkey.busy ? 0.6 : 1 }}
                >
                  {passkey.busy ? 'Adding…' : 'Add a passkey'}
                </button>
              )}
            </div>
            {passkey.error && (
              <span style={{ fontSize: '12px', color: 'var(--down)' }}>{passkey.error}</span>
            )}
            {passkey.success && (
              <span style={{ fontSize: '12px', color: 'var(--up)' }}>{passkey.success}</span>
            )}
          </div>
        </div>

        {authed && (
          <button
            onClick={() => logout()}
            style={{ alignSelf: 'flex-start', height: 40, padding: '0 18px', borderRadius: 11, border: '1px solid var(--line2)', background: 'transparent', color: 'var(--tx2)', fontFamily: FONT_SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Render a QR code for the given otpauth:// URI.
 *
 * Uses the `qrcode` package (already a frontend dep) to generate a data-URI
 * which we display as an <img>. If the package is unavailable for any reason,
 * falls back to showing the raw URI so the user can still set up manually.
 */
function TotpQrCode({ uri }: { uri: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import('qrcode').then(QR => {
      QR.default.toDataURL(uri, { width: 180, margin: 2 }).then((url: string) => {
        if (!cancelled) setSrc(url)
      }).catch(() => { /* ignore */ })
    }).catch(() => { /* package unavailable */ })
    return () => { cancelled = true }
  }, [uri])

  if (src) {
    return (
      <img
        src={src}
        alt="TOTP QR code"
        width={180}
        height={180}
        style={{ borderRadius: 12, border: '1px solid var(--line2)', background: '#fff' }}
      />
    )
  }

  // Graceful fallback: show the raw URI
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line2)', fontSize: '10px', color: 'var(--tx3)', wordBreak: 'break-all', maxWidth: 280 }}>
      {uri}
    </div>
  )
}
