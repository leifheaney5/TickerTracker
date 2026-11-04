import { useState } from 'react'

export function NewsSourceLogo({ source, url }: { source: string; url: string }) {
  const [failed, setFailed] = useState(false)
  let host = ''
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') host = parsed.hostname.replace(/^www\./, '')
  } catch { /* initials are the safe fallback */ }
  const initials = source.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'N'
  return <span aria-hidden="true" style={{ width: 24, height: 24, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 7, background: '#fff', color: '#151822', fontSize: 9, fontWeight: 800 }}>
    {host && !failed ? <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`} alt="" width={18} height={18} onError={() => setFailed(true)} /> : initials}
  </span>
}
