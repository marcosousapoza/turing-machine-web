import { describe, expect, it } from 'vitest'
import { formatTape, pasteTape, replaceTape } from './tape'

describe('tape formatting', () => {
  it('preserves byte width in hexadecimal output', () => {
    expect(formatTape([...`00000001`], 'hex')).toBe('0x01')
  })

  it('formats delimited words independently', () => {
    const tape = [...`00000001#00001111#`]
    expect(formatTape(tape, 'symbols')).toBe('00000001#00001111#')
    expect(formatTape(tape, 'binary')).toBe('0b00000001#0b00001111#')
    expect(formatTape(tape, 'hex')).toBe('0x01#0x0f#')
    expect(formatTape(tape, 'decimal')).toBe('1#15#')
  })

  it('keeps raw symbols available for internal blanks', () => {
    const tape = ['0', '⊔', '1', '⊔']
    expect(formatTape(tape, 'symbols')).toBe('0⊔1')
    expect(formatTape(tape, 'hex')).toBe('Contains internal blanks')
  })
})

describe('tape editing', () => {
  it('extends and trims the tape with blank cells', () => {
    expect(replaceTape([], 2, '1')).toBe('⊔⊔1')
    expect(replaceTape(['1'], 0, '⊔')).toBe('')
  })

  it('pastes raw symbols and rejects encoded input', () => {
    expect(pasteTape([...`00#`], 1, '1#0')).toBe('01#0')
    expect(() => pasteTape([], 0, '0x01')).toThrow('Tape symbol `x` is invalid')
  })
})
