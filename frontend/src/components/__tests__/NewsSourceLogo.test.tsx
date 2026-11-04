import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NewsSourceLogo } from '../NewsSourceLogo'

describe('NewsSourceLogo', () => {
  it('uses an http publisher hostname and falls back to initials on failure', () => {
    const { container } = render(<NewsSourceLogo source="Reuters" url="https://www.reuters.com/article" />)
    const image = container.querySelector('img')!
    expect(image.src).toContain('reuters.com')
    fireEvent.error(image)
    expect(screen.getByText('R')).toBeInTheDocument()
  })

  it('never builds an image from an unsafe URL', () => {
    render(<NewsSourceLogo source="CNBC" url="javascript:alert(1)" />)
    expect(screen.getByText('C')).toBeInTheDocument()
  })
})
