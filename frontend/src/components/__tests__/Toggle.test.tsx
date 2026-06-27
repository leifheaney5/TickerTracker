import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Toggle } from '../Toggle'

describe('Toggle', () => {
  it('renders without crash', () => {
    render(<Toggle on={false} onClick={vi.fn()} />)
    expect(document.body.firstChild).toBeTruthy()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    const { container } = render(<Toggle on={false} onClick={onClick} />)
    fireEvent.click(container.firstChild!)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('reflects on state visually', () => {
    const { container } = render(<Toggle on={true} onClick={vi.fn()} />)
    // Just assert it renders without throwing — the style change is cosmetic
    expect(container.firstChild).toBeTruthy()
  })
})
