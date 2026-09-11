import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Footer } from '../Footer'

describe('Footer', () => {
  it('makes Contact us a visible button that opens a dialog', async () => {
    const user = userEvent.setup()
    render(<Footer />)
    await user.click(screen.getByRole('button', { name: 'Contact us' }))
    expect(screen.getByRole('dialog', { name: 'Contact us' })).toBeInTheDocument()
  })
})
