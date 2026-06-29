import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Treemap } from '../Treemap'

const items = [
  { sym: 'AAPL', value: 100, chg: 1.2 },
  { sym: 'MSFT', value: 80, chg: -0.5 },
]

describe('Treemap', () => {
  it('fires onTileClick with the tile symbol', () => {
    const onTileClick = vi.fn()
    const { getByText } = render(<Treemap items={items} width={400} height={300} onTileClick={onTileClick} />)
    fireEvent.click(getByText('AAPL'))
    expect(onTileClick).toHaveBeenCalledWith('AAPL')
  })

  it('shows a tooltip from tipFor on hover and hides on leave', () => {
    const tipFor = (s: string) => `${s} tooltip`
    const { getByText, queryByText, container } = render(
      <Treemap items={items} width={400} height={300} tipFor={tipFor} />,
    )
    expect(queryByText('AAPL tooltip')).toBeNull()
    const tile = getByText('AAPL').closest('g') as SVGGElement
    fireEvent.mouseEnter(tile)
    expect(getByText('AAPL tooltip')).toBeTruthy()
    fireEvent.mouseLeave(container.querySelector('svg') as SVGSVGElement)
    expect(queryByText('AAPL tooltip')).toBeNull()
  })

  it('renders no tooltip when tipFor is omitted (crypto path)', () => {
    const { getByText, container } = render(<Treemap items={items} width={400} height={300} />)
    const tile = getByText('AAPL').closest('g') as SVGGElement
    fireEvent.mouseEnter(tile)
    expect(container.querySelectorAll('[data-treemap-tip]').length).toBe(0)
  })
})
