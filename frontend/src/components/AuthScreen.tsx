import { useState, useEffect } from 'react'
import { useStore } from '../state/store'
import { COLORS, FONT_SANS, FONT_MONO } from '../theme/tokens'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'

function inputStyle(): React.CSSProperties {
  return {
    height: 40, padding: '0 12px', borderRadius: 9,
    border: `1px solid ${COLORS.line2}`, background: COLORS.bg,
    color: COLORS.tx, fontFamily: FONT_SANS, fontSize: '13.5px', width: '100%',
    boxSizing: 'border-box',
  }
}

function labelStyle(): React.CSSProperties {
  return {
    fontSize: '11.5px', fontWeight: 600, color: COLORS.tx2,
    letterSpacing: '.03em', marginBottom: 4, display: 'block',
  }
}

export function AuthScreen() {
  const authModal = useStore((s) => s.authModal)
  const openAuth = useStore((s) => s.openAuth)
  const closeAuth = useStore((s) => s.closeAuth)
  const login = useStore((s) => s.login)
  const signup = useStore((s) => s.signup)
  const forgot = useStore((s) => s.forgot)
  const reset = useStore((s) => s.reset)

  // Detect reset_token in URL to force open modal in reset mode
  const params = new URLSearchParams(window.location.search)
  const resetToken = params.get('reset_token') ?? ''

  const [mode, setMode] = useState<Mode>(resetToken ? 'reset' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false) // success state for signup/forgot/reset

  // If there's a reset token but modal is not open, open it
  useEffect(() => {
    if (resetToken && !authModal) {
      openAuth()
      setMode('reset')
    }
    // Clean reset_token from URL after capturing it, same as verify does
    if (resetToken) {
      const clean = window.location.pathname
      window.history.replaceState(null, '', clean)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render at all when modal is closed and no reset token
  if (!authModal && !resetToken) return null

  function clearState() {
    setEmail(''); setPassword(''); setName(''); setNewPassword('')
    setError(''); setDone(false); setLoading(false)
  }

  function switchMode(m: Mode) {
    clearState()
    setMode(m)
  }

  async function handleLogin() {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true); setError('')
    const res = await login(email, password)
    setLoading(false)
    if (res.ok) { closeAuth() }
    else setError(res.error ?? 'Login failed.')
  }

  async function handleSignup() {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true); setError('')
    const res = await signup(email, password, name || undefined)
    setLoading(false)
    if (res.ok) setDone(true)
    else setError(res.error ?? 'Signup failed.')
  }

  async function handleForgot() {
    if (!email) { setError('Please enter your email.'); return }
    setLoading(true); setError('')
    await forgot(email)
    setLoading(false)
    setDone(true)
  }

  async function handleReset() {
    if (!newPassword) { setError('Please enter a new password.'); return }
    setLoading(true); setError('')
    const res = await reset(resetToken, newPassword)
    setLoading(false)
    if (res.ok) setDone(true)
    else setError(res.error ?? 'Reset failed.')
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  const modal: React.CSSProperties = {
    background: COLORS.panel,
    border: `1px solid ${COLORS.line2}`,
    borderRadius: 20,
    padding: '32px 28px',
    width: '100%', maxWidth: 400,
    boxShadow: '0 24px 64px rgba(0,0,0,.7)',
    position: 'relative',
    display: 'flex', flexDirection: 'column', gap: 20,
    fontFamily: FONT_SANS,
  }

  const primaryBtn: React.CSSProperties = {
    width: '100%', height: 42, borderRadius: 10, border: 'none',
    background: COLORS.accent, color: COLORS.accentInk,
    fontFamily: FONT_SANS, fontWeight: 700, fontSize: '14px', cursor: 'pointer',
  }

  const ghostBtn: React.CSSProperties = {
    background: 'transparent', border: 'none', color: COLORS.accent,
    fontFamily: FONT_SANS, fontSize: '12.5px', fontWeight: 600,
    cursor: 'pointer', padding: 0, textDecoration: 'underline',
  }

  const googleBtn: React.CSSProperties = {
    width: '100%', height: 42, borderRadius: 10,
    border: `1px solid ${COLORS.line2}`,
    background: COLORS.card, color: COLORS.tx,
    fontFamily: FONT_SANS, fontWeight: 600, fontSize: '13.5px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  }

  const divider: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    color: COLORS.tx3, fontSize: '11.5px',
  }

  const divLine: React.CSSProperties = {
    flex: 1, height: 1, background: COLORS.line2,
  }

  function renderLogin() {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span style={labelStyle()}>EMAIL</span>
            <input style={inputStyle()} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
          </div>
          <div>
            <span style={labelStyle()}>PASSWORD</span>
            <input style={inputStyle()} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
        </div>
        {error && <span style={{ fontSize: '12.5px', color: COLORS.down }}>{error}</span>}
        <button style={primaryBtn} disabled={loading} onClick={handleLogin}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
        <div style={divider}><span style={divLine} /><span>or</span><span style={divLine} /></div>
        <button style={googleBtn} onClick={() => { window.location.href = '/api/auth/google' }}>
          <span style={{ fontSize: '15px', fontFamily: FONT_MONO }}>G</span>Continue with Google
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <div style={{ fontSize: '12.5px', color: COLORS.tx3 }}>
            No account?{' '}
            <button style={ghostBtn} onClick={() => switchMode('signup')}>Sign up</button>
          </div>
          <button style={{ ...ghostBtn, color: COLORS.tx3 }} onClick={() => switchMode('forgot')}>Forgot password?</button>
        </div>
      </>
    )
  }

  function renderSignup() {
    if (done) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span style={{ fontSize: '28px' }}>✉️</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.tx }}>Check your email</span>
          <span style={{ fontSize: '13px', color: COLORS.tx2, lineHeight: 1.6 }}>
            We sent a verification link to <strong style={{ color: COLORS.tx }}>{email}</strong>.
            Click it to activate your account, then come back to log in.
          </span>
          <button style={{ ...ghostBtn, marginTop: 8 }} onClick={() => switchMode('login')}>Back to log in</button>
        </div>
      )
    }
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span style={labelStyle()}>NAME (optional)</span>
            <input style={inputStyle()} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus />
          </div>
          <div>
            <span style={labelStyle()}>EMAIL</span>
            <input style={inputStyle()} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <span style={labelStyle()}>PASSWORD</span>
            <input style={inputStyle()} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignup()} />
          </div>
        </div>
        {error && <span style={{ fontSize: '12.5px', color: COLORS.down }}>{error}</span>}
        <button style={primaryBtn} disabled={loading} onClick={handleSignup}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <div style={divider}><span style={divLine} /><span>or</span><span style={divLine} /></div>
        <button style={googleBtn} onClick={() => { window.location.href = '/api/auth/google' }}>
          <span style={{ fontSize: '15px', fontFamily: FONT_MONO }}>G</span>Continue with Google
        </button>
        <div style={{ fontSize: '12.5px', color: COLORS.tx3, textAlign: 'center' }}>
          Already have an account?{' '}
          <button style={ghostBtn} onClick={() => switchMode('login')}>Log in</button>
        </div>
      </>
    )
  }

  function renderForgot() {
    if (done) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span style={{ fontSize: '28px' }}>📬</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.tx }}>Check your inbox</span>
          <span style={{ fontSize: '13px', color: COLORS.tx2, lineHeight: 1.6 }}>
            If that email address is registered, we've sent a reset link.
          </span>
          <button style={{ ...ghostBtn, marginTop: 8 }} onClick={() => switchMode('login')}>Back to log in</button>
        </div>
      )
    }
    return (
      <>
        <div>
          <span style={labelStyle()}>EMAIL</span>
          <input style={inputStyle()} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus onKeyDown={e => e.key === 'Enter' && handleForgot()} />
        </div>
        {error && <span style={{ fontSize: '12.5px', color: COLORS.down }}>{error}</span>}
        <button style={primaryBtn} disabled={loading} onClick={handleForgot}>
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
        <div style={{ fontSize: '12.5px', color: COLORS.tx3, textAlign: 'center' }}>
          <button style={ghostBtn} onClick={() => switchMode('login')}>Back to log in</button>
        </div>
      </>
    )
  }

  function renderReset() {
    if (done) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
          <span style={{ fontSize: '28px' }}>✅</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.tx }}>Password updated</span>
          <span style={{ fontSize: '13px', color: COLORS.tx2, lineHeight: 1.6 }}>
            Your password has been reset. You can now log in with your new password.
          </span>
          <button style={{ ...ghostBtn, marginTop: 8 }} onClick={() => switchMode('login')}>Log in</button>
        </div>
      )
    }
    return (
      <>
        <div>
          <span style={labelStyle()}>NEW PASSWORD</span>
          <input style={inputStyle()} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" autoFocus onKeyDown={e => e.key === 'Enter' && handleReset()} />
        </div>
        {error && <span style={{ fontSize: '12.5px', color: COLORS.down }}>{error}</span>}
        <button style={primaryBtn} disabled={loading} onClick={handleReset}>
          {loading ? 'Saving…' : 'Set new password'}
        </button>
      </>
    )
  }

  const titles: Record<Mode, string> = {
    login: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset password',
    reset: 'Set new password',
  }

  const subtitles: Record<Mode, string> = {
    login: 'Log in to your Ticker Tracker account',
    signup: 'Start tracking your portfolio',
    forgot: 'Enter your email and we\'ll send a reset link',
    reset: 'Choose a strong new password',
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) closeAuth() }}>
      <div style={modal}>
        {/* Close button */}
        <button
          onClick={closeAuth}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 30, height: 30, borderRadius: '50%',
            border: `1px solid ${COLORS.line2}`, background: COLORS.card,
            color: COLORS.tx2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontFamily: FONT_SANS,
          }}
          aria-label="Close"
        >
          ×
        </button>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-.02em', color: COLORS.tx }}>
            {titles[mode]}
          </span>
          <span style={{ fontSize: '13px', color: COLORS.tx2 }}>{subtitles[mode]}</span>
        </div>

        {mode === 'login' && renderLogin()}
        {mode === 'signup' && renderSignup()}
        {mode === 'forgot' && renderForgot()}
        {mode === 'reset' && renderReset()}
      </div>
    </div>
  )
}
