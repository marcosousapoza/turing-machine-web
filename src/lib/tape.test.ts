import { describe, expect, it } from 'vitest'
import { pasteTape, replaceTape } from './tape'

describe('tape editing', () => {
  it('extends and trims the tape with blank cells', () => {
    expect(replaceTape([], 2, '1')).toBe('⊔⊔1')
    expect(replaceTape(['1'], 0, '⊔')).toBe('')
  })

  it('pastes arbitrary Unicode symbols including whitespace', () => {
    expect(pasteTape([...`ab`], 1, ' λ,')).toBe('a λ,')
  })
})
