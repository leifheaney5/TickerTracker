import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShortcutsHelp } from '../ShortcutsHelp'

describe('ShortcutsHelp', () => {
  it('renders nothing when closed', () => {
    render(<ShortcutsHelp open={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Keyboard shortcuts')).toBeNull()
  })

  it('renders shortcuts overlay when open', () => {
    render(<ShortcutsHelp open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Focus search')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<ShortcutsHelp open={true} onClose={onClose} />)
    fireEvent.click(container.firstChild!)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<ShortcutsHelp open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close shortcuts help' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
