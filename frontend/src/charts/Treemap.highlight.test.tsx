// frontend/src/charts/Treemap.highlight.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Treemap } from './Treemap'

describe('Treemap highlight', () => {
  it('renders a highlight stroke on watchlisted tiles', () => {
    const { container } = render(
      <Treemap width={200} height={200}
        items={[{ sym: 'BTC', value: 10, chg: 1 }, { sym: 'ETH', value: 5, chg: -1 }]}
        highlight={new Set(['BTC'])} />)
    const stroked = container.querySelectorAll('rect[stroke="#fff"]')
    expect(stroked.length).toBe(1)
  })
})
