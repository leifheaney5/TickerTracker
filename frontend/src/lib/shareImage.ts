import { toBlob } from 'html-to-image'

// Rasterize a DOM node to a PNG and either open the OS share sheet (when the
// browser can share files) or download the file. A user-cancelled share is a
// silent no-op; a failed render rejects.
export async function shareImage(node: HTMLElement, filename: string): Promise<void> {
  const blob = await toBlob(node, { pixelRatio: 2 })
  if (!blob) throw new Error('Failed to render image')

  const file = new File([blob], filename, { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'My Watchlist' })
    } catch (err) {
      // User dismissed the share sheet — not an error.
      if ((err as DOMException)?.name === 'AbortError') return
      throw err
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
