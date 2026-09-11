import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TargetEditor, TargetSummary } from '../TargetEditor'

describe('TargetEditor', () => {
  it('keeps labelled buy and sell inputs visible and saves explicit target names', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TargetEditor buyTarget={180} sellTarget={240} onSave={onSave} onCancel={() => {}} />)

    const buy = screen.getByLabelText('Buy target')
    const sell = screen.getByLabelText('Sell target')
    expect(buy).toHaveValue(180)
    expect(sell).toHaveValue(240)

    await user.clear(buy)
    await user.type(buy, '185')
    await user.click(screen.getByRole('button', { name: 'Save targets' }))

    expect(onSave).toHaveBeenCalledWith({ buy_target: 185, sell_target: 240 })
  })

  it('clears either target to zero before saving', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TargetEditor buyTarget={180} sellTarget={240} onSave={onSave} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Clear buy target' }))
    await user.click(screen.getByRole('button', { name: 'Save targets' }))

    expect(onSave).toHaveBeenCalledWith({ buy_target: 0, sell_target: 240 })
  })

  it('shows actionable feedback and does not save invalid values', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<TargetEditor buyTarget={0} sellTarget={0} onSave={onSave} onCancel={() => {}} />)

    fireEvent.change(screen.getByLabelText('Buy target'), { target: { value: '-5' } })
    await user.click(screen.getByRole('button', { name: 'Save targets' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a positive price or leave the field blank to clear it.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('cancels without saving changed values', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<TargetEditor buyTarget={180} sellTarget={240} onSave={onSave} onCancel={onCancel} />)

    await user.clear(screen.getByLabelText('Sell target'))
    await user.type(screen.getByLabelText('Sell target'), '260')
    await user.click(screen.getByRole('button', { name: 'Cancel target editing' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('surfaces a failed save and keeps the editor open', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('offline'))
    render(<TargetEditor buyTarget={180} sellTarget={240} onSave={onSave} onCancel={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Save targets' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Targets could not be saved. Try again.')
    expect(screen.getByLabelText('Buy target')).toBeInTheDocument()
  })
})

describe('TargetSummary', () => {
  it('shows both configured targets with literal distance text', () => {
    render(<TargetSummary buyTarget={190} sellTarget={250} price={200} />)
    expect(screen.getByText('Buy $190.00 · 5.0% away')).toBeInTheDocument()
    expect(screen.getByText('Sell $250.00 · 25.0% away')).toBeInTheDocument()
  })

  it('uses an icon and a word when a target is reached', () => {
    render(<TargetSummary buyTarget={205} sellTarget={190} price={200} />)
    expect(screen.getByText('Buy $205.00 · ✓ Reached')).toBeInTheDocument()
    expect(screen.getByText('Sell $190.00 · ✓ Reached')).toBeInTheDocument()
  })
})
