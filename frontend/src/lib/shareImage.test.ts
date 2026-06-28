import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock html-to-image so no real canvas is needed.
const toBlob = vi.fn()
vi.mock('html-to-image', () => ({ toBlob: (...a: unknown[]) => toBlob(...a) }))

import { shareImage } from './shareImage'

const node = document.createElement('div')
const pngBlob = new Blob(['x'], { type: 'image/png' })

beforeEach(() => {
  toBlob.mockReset().mockResolvedValue(pngBlob)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('shareImage', () => {
  it('uses the native share sheet when files are shareable', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { canShare, share })

    await shareImage(node, 'my-watchlist.png')

    expect(share).toHaveBeenCalledTimes(1)
    const arg = share.mock.calls[0][0]
    expect(arg.files[0].name).toBe('my-watchlist.png')
  })

  it('falls back to downloading when sharing is unavailable', async () => {
    vi.stubGlobal('navigator', {}) // no canShare/share
    const createURL = vi.fn().mockReturnValue('blob:fake')
    const revokeURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: createURL, revokeObjectURL: revokeURL })
    const click = vi.fn()
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag)
      if (tag === 'a') el.click = click
      return el
    })

    await shareImage(node, 'my-watchlist.png')

    expect(createURL).toHaveBeenCalledWith(pngBlob)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeURL).toHaveBeenCalledWith('blob:fake')
  })

  it('swallows a user-cancelled share (AbortError)', async () => {
    const err = new DOMException('cancelled', 'AbortError')
    const share = vi.fn().mockRejectedValue(err)
    vi.stubGlobal('navigator', { canShare: () => true, share })

    await expect(shareImage(node, 'my-watchlist.png')).resolves.toBeUndefined()
  })

  it('rejects when rasterization yields no blob', async () => {
    toBlob.mockResolvedValue(null)
    vi.stubGlobal('navigator', {})
    await expect(shareImage(node, 'my-watchlist.png')).rejects.toThrow()
  })
})
